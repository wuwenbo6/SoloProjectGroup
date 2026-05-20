import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Dict
from ..database.db_manager import DatabaseManager


class UserManager:
    def __init__(self, db_manager: DatabaseManager, secret_key: str = 'opera-secret-key'):
        self.db_manager = db_manager
        self.secret_key = secret_key

    def generate_token(self, user_id: int, expires_hours: int = 24) -> str:
        payload = {
            'user_id': user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=expires_hours),
            'iat': datetime.datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm='HS256')

    def verify_token(self, token: str) -> Optional[int]:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload['user_id']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def register_user(self, username: str, email: str, password: str,
                      full_name: Optional[str] = None, role: str = 'user') -> Dict:
        if self.db_manager.get_user(username=username):
            return {'success': False, 'message': '用户名已存在'}

        if self.db_manager.get_user(email=email):
            return {'success': False, 'message': '邮箱已被注册'}

        user = self.db_manager.create_user(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            role=role
        )

        token = self.generate_token(user.id)

        return {
            'success': True,
            'user': user.to_dict(),
            'token': token
        }

    def login_user(self, username: str, password: str) -> Dict:
        user = self.db_manager.verify_user(username, password)
        if not user:
            return {'success': False, 'message': '用户名或密码错误'}

        token = self.generate_token(user.id)

        return {
            'success': True,
            'user': user.to_dict(),
            'token': token
        }

    def get_current_user(self, token: str):
        user_id = self.verify_token(token)
        if user_id:
            return self.db_manager.get_user(user_id=user_id)
        return None

    def change_password(self, user_id: int, old_password: str, new_password: str) -> Dict:
        user = self.db_manager.get_user(user_id=user_id)
        if not user:
            return {'success': False, 'message': '用户不存在'}

        if not user.check_password(old_password):
            return {'success': False, 'message': '旧密码错误'}

        self.db_manager.update_user(user_id, password=new_password)
        return {'success': True, 'message': '密码修改成功'}

    def reset_password(self, email: str, new_password: str) -> Dict:
        user = self.db_manager.get_user(email=email)
        if not user:
            return {'success': False, 'message': '邮箱不存在'}

        self.db_manager.update_user(user.id, password=new_password)
        return {'success': True, 'message': '密码重置成功'}

    def update_profile(self, user_id: int, **kwargs) -> Dict:
        allowed_fields = ['full_name', 'email']
        update_data = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not update_data:
            return {'success': False, 'message': '没有可更新的字段'}

        user = self.db_manager.update_user(user_id, **update_data)
        if user:
            return {'success': True, 'user': user.to_dict()}
        return {'success': False, 'message': '更新失败'}

    def deactivate_user(self, user_id: int) -> Dict:
        user = self.db_manager.update_user(user_id, is_active=False)
        if user:
            return {'success': True, 'message': '用户已停用'}
        return {'success': False, 'message': '操作失败'}

    def activate_user(self, user_id: int) -> Dict:
        user = self.db_manager.update_user(user_id, is_active=True)
        if user:
            return {'success': True, 'message': '用户已激活'}
        return {'success': False, 'message': '操作失败'}


def auth_required(user_manager: UserManager):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': '缺少授权头'}), 401

            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != 'bearer':
                return jsonify({'error': '无效的授权格式'}), 401

            token = parts[1]
            user = user_manager.get_current_user(token)
            if not user:
                return jsonify({'error': '无效或已过期的令牌'}), 401

            g.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator
