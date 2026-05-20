import hmac
import hashlib
import time
import base64
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_auth_db
from app.models.auth import ApiKey

NONCE_CACHE: Dict[str, float] = {}
REQUEST_CACHE_TTL = 300

SECRET_KEY_BYTES = settings.SECRET_KEY.encode()
if len(SECRET_KEY_BYTES) < 32:
    SECRET_KEY_BYTES = hashlib.sha256(SECRET_KEY_BYTES).digest()
FERNET_KEY = base64.urlsafe_b64encode(SECRET_KEY_BYTES)

try:
    from cryptography.fernet import Fernet
    fernet = Fernet(FERNET_KEY)
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

    class SimpleFernet:
        @staticmethod
        def encrypt(data: bytes) -> bytes:
            xor_key = SECRET_KEY_BYTES
            result = bytearray()
            for i, b in enumerate(data):
                result.append(b ^ xor_key[i % len(xor_key)])
            return base64.urlsafe_b64encode(bytes(result))

        @staticmethod
        def decrypt(data: bytes) -> bytes:
            decoded = base64.urlsafe_b64decode(data)
            xor_key = SECRET_KEY_BYTES
            result = bytearray()
            for i, b in enumerate(decoded):
                result.append(b ^ xor_key[i % len(xor_key)])
            return bytes(result)

    fernet = SimpleFernet()


def generate_signature(data: str, timestamp: int, nonce: str, secret: str) -> str:
    message = f"{data}{timestamp}{nonce}{secret}"
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def verify_request_signature(
    signature: str,
    data: str,
    timestamp: int,
    nonce: str,
    secret: str
) -> bool:
    current_time = int(time.time())
    if abs(current_time - timestamp) > 300:
        return False

    if nonce in NONCE_CACHE:
        if time.time() - NONCE_CACHE[nonce] < REQUEST_CACHE_TTL:
            return False

    expected_signature = generate_signature(data, timestamp, nonce, secret)
    if not hmac.compare_digest(expected_signature, signature):
        return False

    NONCE_CACHE[nonce] = time.time()
    return True


def encrypt_response(data: Any) -> str:
    json_str = json.dumps(data, ensure_ascii=False)
    encrypted = fernet.encrypt(json_str.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_response(encrypted_data: str) -> Any:
    try:
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = fernet.decrypt(encrypted_bytes)
        return json.loads(decrypted.decode())
    except Exception:
        return None


def mask_sensitive_data(data: Any, sensitive_fields: list = None) -> Any:
    if sensitive_fields is None:
        sensitive_fields = ["password", "secret", "token", "key", "private", "phone", "email"]

    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if any(s in key.lower() for s in sensitive_fields):
                if isinstance(value, str) and len(value) > 4:
                    result[key] = value[:2] + "*" * (len(value) - 4) + value[-2:]
                else:
                    result[key] = "***"
            elif isinstance(value, (dict, list)):
                result[key] = mask_sensitive_data(value, sensitive_fields)
            else:
                result[key] = value
        return result
    elif isinstance(data, list):
        return [mask_sensitive_data(item, sensitive_fields) for item in data]
    else:
        return data


def generate_api_signature(api_key: str, http_method: str, path: str,
                          query_string: str = "", body: str = "",
                          timestamp: Optional[int] = None) -> Dict[str, str]:
    if timestamp is None:
        timestamp = int(time.time())
    nonce = hashlib.md5(f"{timestamp}{time.time_ns()}".encode()).hexdigest()[:16]

    message = f"{http_method}{path}{query_string}{body}{timestamp}{nonce}{api_key}"
    signature = hmac.new(SECRET_KEY_BYTES, message.encode(), hashlib.sha256).hexdigest()

    return {
        "signature": signature,
        "timestamp": timestamp,
        "nonce": nonce
    }


async def verify_signed_request(request: Request, db: Session) -> bool:
    try:
        api_key = request.headers.get("X-API-Key")
        signature = request.headers.get("X-Signature")
        timestamp = request.headers.get("X-Timestamp")
        nonce = request.headers.get("X-Nonce")

        if not all([api_key, signature, timestamp, nonce]):
            return False

        try:
            timestamp = int(timestamp)
        except ValueError:
            return False

        current_time = int(time.time())
        if abs(current_time - timestamp) > 300:
            return False

        cache_key = f"{nonce}:{timestamp}"
        if cache_key in NONCE_CACHE:
            return False
        NONCE_CACHE[cache_key] = time.time()

        db_api_key = db.query(ApiKey).filter(
            ApiKey.key == api_key, ApiKey.is_active == True
        ).first()

        if not db_api_key:
            return False

        http_method = request.method
        path = request.url.path
        query_string = request.url.query or ""

        try:
            body = await request.body()
            body_str = body.decode() if body else ""
        except Exception:
            body_str = ""

        message = f"{http_method}{path}{query_string}{body_str}{timestamp}{nonce}{api_key}"
        expected_signature = hmac.new(
            SECRET_KEY_BYTES, message.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_signature, signature)
    except Exception:
        return False


def clean_nonce_cache():
    current_time = time.time()
    expired_keys = [k for k, v in NONCE_CACHE.items() if current_time - v > REQUEST_CACHE_TTL]
    for key in expired_keys:
        del NONCE_CACHE[key]


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.request_history: Dict[str, list] = {}

    def is_allowed(self, client_id: str) -> bool:
        current_time = time.time()
        if client_id not in self.request_history:
            self.request_history[client_id] = []

        self.request_history[client_id] = [
            t for t in self.request_history[client_id]
            if current_time - t < 60
        ]

        if len(self.request_history[client_id]) >= self.requests_per_minute:
            return False

        self.request_history[client_id].append(current_time)
        return True

    def get_remaining(self, client_id: str) -> int:
        current_time = time.time()
        if client_id not in self.request_history:
            return self.requests_per_minute

        recent_requests = [
            t for t in self.request_history[client_id]
            if current_time - t < 60
        ]
        return self.requests_per_minute - len(recent_requests)


rate_limiter = RateLimiter(requests_per_minute=120)


def generate_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def verify_hash(data: str, expected_hash: str) -> bool:
    return hmac.compare_digest(generate_hash(data), expected_hash)


def encrypt_sensitive_field(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()


def decrypt_sensitive_field(encrypted_value: str) -> str:
    try:
        return fernet.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return ""


def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 7:
        return "***"
    return phone[:3] + "****" + phone[-4:]


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    username, domain = email.split("@", 1)
    if len(username) <= 2:
        username_masked = username[0] + "***"
    else:
        username_masked = username[:2] + "*" * (len(username) - 2)
    return f"{username_masked}@{domain}"
