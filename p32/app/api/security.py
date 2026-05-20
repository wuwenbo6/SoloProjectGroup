from fastapi import APIRouter, Depends, Request, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional
import time

from app.core.database import get_auth_db
from app.models.auth import User, ApiKey
from app.utils.security import authenticate
from app.utils.security_enhanced import (
    verify_signed_request,
    encrypt_response,
    decrypt_response,
    mask_sensitive_data,
    mask_phone,
    mask_email,
    rate_limiter,
    generate_api_signature,
    clean_nonce_cache
)

router = APIRouter(prefix="/security", tags=["安全增强"])


@router.post("/verify-signature")
async def verify_signature_endpoint(
    request: Request,
    db: Session = Depends(get_auth_db),
    auth: dict = Depends(authenticate)
):
    is_valid = await verify_signed_request(request, db)
    return {
        "valid": is_valid,
        "message": "签名验证成功" if is_valid else "签名验证失败"
    }


@router.post("/encrypt")
async def encrypt_data(
    data: dict,
    auth: dict = Depends(authenticate)
):
    encrypted = encrypt_response(data)
    return {
        "encrypted": True,
        "data": encrypted
    }


@router.post("/decrypt")
async def decrypt_data(
    encrypted_data: str,
    auth: dict = Depends(authenticate)
):
    decrypted = decrypt_response(encrypted_data)
    if decrypted is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="解密失败，数据格式无效"
        )
    return {
        "decrypted": True,
        "data": decrypted
    }


@router.post("/mask")
async def mask_data(
    data: dict,
    auth: dict = Depends(authenticate)
):
    masked = mask_sensitive_data(data)
    return {
        "masked": True,
        "data": masked
    }


@router.get("/signature/generate")
async def get_signature_example(
    http_method: str = "GET",
    path: str = "/api/v1/material",
    query_string: str = "",
    body: str = "",
    auth: dict = Depends(authenticate)
):
    api_key = "your-api-key-here"
    sig_info = generate_api_signature(api_key, http_method, path, query_string, body)
    return {
        "example": {
            "headers": {
                "X-API-Key": api_key,
                "X-Signature": sig_info["signature"],
                "X-Timestamp": str(sig_info["timestamp"]),
                "X-Nonce": sig_info["nonce"]
            }
        },
        "signature": sig_info["signature"],
        "timestamp": sig_info["timestamp"],
        "nonce": sig_info["nonce"],
        "algorithm": "HMAC-SHA256",
        "note": "签名公式: HMAC-SHA256(Method + Path + QueryString + Body + Timestamp + Nonce + APIKey)"
    }


@router.get("/rate-limit/status")
async def get_rate_limit_status(
    request: Request,
    auth: dict = Depends(authenticate)
):
    client_ip = request.client.host if request.client else "unknown"
    remaining = rate_limiter.get_remaining(client_ip)
    return {
        "client_ip": client_ip,
        "requests_per_minute": rate_limiter.requests_per_minute,
        "remaining": remaining,
        "limit_reached": remaining <= 0
    }


@router.post("/clean-cache")
async def clean_cache(
    auth: dict = Depends(authenticate)
):
    clean_nonce_cache()
    return {
        "message": "缓存清理成功",
        "timestamp": int(time.time())
    }


@router.get("/masking/phone")
async def mask_phone_example(phone: str):
    return {
        "original": phone,
        "masked": mask_phone(phone)
    }


@router.get("/masking/email")
async def mask_email_example(email: str):
    return {
        "original": email,
        "masked": mask_email(email)
    }


@router.get("/keys")
async def list_api_keys(
    db: Session = Depends(get_auth_db),
    auth: dict = Depends(authenticate)
):
    api_keys = db.query(ApiKey).filter(
        ApiKey.user_id == auth.get("user_id") if auth.get("user_id") else True
    ).all()

    result = []
    for key in api_keys:
        result.append({
            "id": key.id,
            "name": key.name,
            "key_masked": key.key[:8] + "..." + key.key[-4:],
            "description": key.description,
            "is_active": key.is_active,
            "expires_at": key.expires_at,
            "created_at": key.created_at
        })

    return {"api_keys": result}


@router.get("/encryption/info")
async def get_encryption_info():
    return {
        "algorithm": "Fernet (AES-128-CBC + HMAC-SHA256)",
        "key_derivation": "SHA-256",
        "encoding": "Base64 URL Safe",
        "hash_algorithm": "SHA-256",
        "signature_ttl_seconds": 300,
        "rate_limit": {
            "requests_per_minute": rate_limiter.requests_per_minute,
            "window_seconds": 60
        },
        "sensitive_fields": [
            "password",
            "secret",
            "token",
            "key",
            "private",
            "phone",
            "email"
        ]
    }


@router.post("/test")
async def test_security_features(
    data: dict,
    request: Request,
    db: Session = Depends(get_auth_db)
):
    client_ip = request.client.host if request.client else "unknown"

    signature_valid = None
    if request.headers.get("X-Signature"):
        signature_valid = await verify_signed_request(request, db)

    original_data = data
    masked_data = mask_sensitive_data(data)
    encrypted_data = encrypt_response(data)
    decrypted_data = decrypt_response(encrypted_data)

    remaining = rate_limiter.get_remaining(client_ip)

    return {
        "client_ip": client_ip,
        "signature_verification": {
            "provided": request.headers.get("X-Signature") is not None,
            "valid": signature_valid
        },
        "rate_limit": {
            "requests_per_minute": rate_limiter.requests_per_minute,
            "remaining": remaining
        },
        "tests": {
            "masking": {
                "original": original_data,
                "masked": masked_data,
                "success": masked_data != original_data or not original_data
            },
            "encryption": {
                "encrypted": encrypted_data is not None,
                "decrypted": decrypted_data is not None,
                "integrity_check": decrypted_data == original_data
            }
        },
        "timestamp": int(time.time())
    }
