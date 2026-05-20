from functools import wraps
from typing import Optional, List
from flask import request, jsonify, g
from ..database.models import User


class PermissionManager:
    ROLES = {
        'admin': ['create_user', 'delete_user', 'view_all_data', 'manage_system', 'upload_audio', 'analyze_audio'],
        'researcher': ['upload_audio', 'analyze_audio', 'view_own_data', 'export_results'],
        'user': ['upload_audio', 'analyze_audio', 'view_own_data']
    }

    @staticmethod
    def has_permission(user: User, permission: str) -> bool:
        if not user or not user.is_active:
            return False
        if user.role == 'admin':
            return True
        return permission in PermissionManager.ROLES.get(user.role, [])

    @staticmethod
    def is_owner(user: User, resource_user_id: int) -> bool:
        return user.id == resource_user_id

    @staticmethod
    def require_permission(permission: str):
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                if not hasattr(g, 'current_user') or g.current_user is None:
                    return jsonify({'error': '未授权访问'}), 401
                if not PermissionManager.has_permission(g.current_user, permission):
                    return jsonify({'error': '权限不足'}), 403
                return f(*args, **kwargs)
            return decorated_function
        return decorator

    @staticmethod
    def require_ownership_or_permission(user_id_param: str, permission: str):
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                if not hasattr(g, 'current_user') or g.current_user is None:
                    return jsonify({'error': '未授权访问'}), 401

                resource_user_id = kwargs.get(user_id_param) or request.view_args.get(user_id_param)
                if resource_user_id is None:
                    return jsonify({'error': '缺少用户ID参数'}), 400

                if PermissionManager.is_owner(g.current_user, int(resource_user_id)):
                    return f(*args, **kwargs)

                if PermissionManager.has_permission(g.current_user, permission):
                    return f(*args, **kwargs)

                return jsonify({'error': '权限不足'}), 403
            return decorated_function
        return decorator

    @staticmethod
    def get_role_permissions(role: str) -> List[str]:
        return PermissionManager.ROLES.get(role, [])

    @staticmethod
    def get_available_roles() -> List[str]:
        return list(PermissionManager.ROLES.keys())


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'current_user') or g.current_user is None:
            return jsonify({'error': '未授权访问'}), 401
        return f(*args, **kwargs)
    return decorated
