import hashlib
import secrets
from typing import Dict, Any, Optional, List, Set
from datetime import datetime, timedelta
import json
import os


class User:
    def __init__(self, user_id: str, username: str, email: str, 
                 role: str = "viewer", password_hash: str = None):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.password_hash = password_hash
        self.created_at = datetime.now().isoformat()
        self.last_login: Optional[str] = None
        self.permissions: Set[str] = set()
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "password_hash": self.password_hash,
            "created_at": self.created_at,
            "last_login": self.last_login,
            "permissions": list(self.permissions)
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        user = cls(
            user_id=data["user_id"],
            username=data["username"],
            email=data["email"],
            role=data["role"],
            password_hash=data.get("password_hash")
        )
        user.created_at = data.get("created_at", user.created_at)
        user.last_login = data.get("last_login")
        user.permissions = set(data.get("permissions", []))
        return user


class Role:
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.permissions: Set[str] = set()
        self.inherits: List[str] = []
        
    def add_permission(self, permission: str):
        self.permissions.add(permission)
        
    def remove_permission(self, permission: str):
        if permission in self.permissions:
            self.permissions.remove(permission)
            
    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "permissions": list(self.permissions),
            "inherits": self.inherits
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Role':
        role = cls(name=data["name"], description=data.get("description", ""))
        role.permissions = set(data.get("permissions", []))
        role.inherits = data.get("inherits", [])
        return role


class DataPermission:
    def __init__(self, dataset_id: str, user_id: str,
                 can_read: bool = False, can_write: bool = False,
                 can_analyze: bool = False, can_export: bool = False):
        self.dataset_id = dataset_id
        self.user_id = user_id
        self.can_read = can_read
        self.can_write = can_write
        self.can_analyze = can_analyze
        self.can_export = can_export
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dataset_id": self.dataset_id,
            "user_id": self.user_id,
            "can_read": self.can_read,
            "can_write": self.can_write,
            "can_analyze": self.can_analyze,
            "can_export": self.can_export
        }


class RBACManager:
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        self.users: Dict[str, User] = {}
        self.roles: Dict[str, Role] = {}
        self.data_permissions: Dict[str, Dict[str, DataPermission]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {}
        
        self._init_default_roles()
        self._load_from_storage()
        
    def _init_default_roles(self):
        admin_role = Role("admin", "系统管理员，拥有所有权限")
        admin_role.permissions.update({
            "user.manage", "role.manage", "data.read", "data.write",
            "data.analyze", "data.export", "system.config"
        })
        self.roles["admin"] = admin_role
        
        analyst_role = Role("analyst", "数据分析师，可分析和导出数据")
        analyst_role.permissions.update({
            "data.read", "data.analyze", "data.export"
        })
        self.roles["analyst"] = analyst_role
        
        editor_role = Role("editor", "数据编辑者，可读写数据")
        editor_role.permissions.update({
            "data.read", "data.write"
        })
        self.roles["editor"] = editor_role
        
        viewer_role = Role("viewer", "只读用户，仅可查看数据")
        viewer_role.permissions.update({
            "data.read"
        })
        self.roles["viewer"] = viewer_role
        
    def _hash_password(self, password: str, salt: str = None) -> str:
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return f"{salt}:{hashed.hex()}"
    
    def _verify_password(self, password: str, stored_hash: str) -> bool:
        try:
            salt, hashed = stored_hash.split(":")
            computed = self._hash_password(password, salt)
            return computed == stored_hash
        except:
            return False
    
    def create_user(self, username: str, email: str, password: str,
                     role: str = "viewer") -> Optional[User]:
        if username in [u.username for u in self.users.values()]:
            return None
        
        user_id = f"user_{secrets.token_hex(8)}"
        password_hash = self._hash_password(password)
        user = User(user_id, username, email, role, password_hash)
        
        if role in self.roles:
            user.permissions.update(self.roles[role].permissions)
        
        self.users[user_id] = user
        self._save_to_storage()
        return user
    
    def delete_user(self, user_id: str) -> bool:
        if user_id in self.users:
            del self.users[user_id]
            self._save_to_storage()
            return True
        return False
    
    def get_user(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        for user in self.users.values():
            if user.username == username:
                return user
        return None
    
    def authenticate(self, username: str, password: str) -> Optional[User]:
        user = self.get_user_by_username(username)
        if user and user.password_hash and self._verify_password(password, user.password_hash):
            user.last_login = datetime.now().isoformat()
            self._save_to_storage()
            return user
        return None
    
    def create_session(self, user: User, expires_hours: int = 24) -> str:
        session_id = secrets.token_hex(32)
        expires_at = (datetime.now() + timedelta(hours=expires_hours)).isoformat()
        
        self.sessions[session_id] = {
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role,
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at
        }
        return session_id
    
    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.now() > expires_at:
            del self.sessions[session_id]
            return None
        
        return session
    
    def invalidate_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def assign_role(self, user_id: str, role_name: str) -> bool:
        if user_id not in self.users or role_name not in self.roles:
            return False
        
        user = self.users[user_id]
        user.role = role_name
        user.permissions.clear()
        user.permissions.update(self.roles[role_name].permissions)
        self._save_to_storage()
        return True
    
    def has_permission(self, user_id: str, permission: str) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        
        if permission in user.permissions:
            return True
        
        role = self.roles.get(user.role)
        if role and permission in role.permissions:
            return True
            
        return False
    
    def set_data_permission(self, dataset_id: str, user_id: str,
                            can_read: bool = None, can_write: bool = None,
                            can_analyze: bool = None, can_export: bool = None) -> bool:
        if dataset_id not in self.data_permissions:
            self.data_permissions[dataset_id] = {}
        
        if user_id not in self.data_permissions[dataset_id]:
            self.data_permissions[dataset_id][user_id] = DataPermission(
                dataset_id, user_id
            )
        
        permission = self.data_permissions[dataset_id][user_id]
        
        if can_read is not None:
            permission.can_read = can_read
        if can_write is not None:
            permission.can_write = can_write
        if can_analyze is not None:
            permission.can_analyze = can_analyze
        if can_export is not None:
            permission.can_export = can_export
        
        self._save_to_storage()
        return True
    
    def check_data_permission(self, dataset_id: str, user_id: str,
                               action: str) -> bool:
        if dataset_id not in self.data_permissions:
            return False
        
        if user_id not in self.data_permissions[dataset_id]:
            return False
        
        permission = self.data_permissions[dataset_id][user_id]
        
        if action == "read":
            return permission.can_read
        elif action == "write":
            return permission.can_write
        elif action == "analyze":
            return permission.can_analyze
        elif action == "export":
            return permission.can_export
        
        return False
    
    def get_user_datasets(self, user_id: str) -> List[str]:
        datasets = []
        for dataset_id, permissions in self.data_permissions.items():
            if user_id in permissions:
                perm = permissions[user_id]
                if perm.can_read or perm.can_write or perm.can_analyze or perm.can_export:
                    datasets.append(dataset_id)
        return datasets
    
    def create_role(self, name: str, description: str = "",
                     permissions: List[str] = None) -> Optional[Role]:
        if name in self.roles:
            return None
        
        role = Role(name, description)
        if permissions:
            role.permissions.update(permissions)
        
        self.roles[name] = role
        self._save_to_storage()
        return role
    
    def delete_role(self, name: str) -> bool:
        if name in self.roles and name not in ["admin", "analyst", "editor", "viewer"]:
            del self.roles[name]
            self._save_to_storage()
            return True
        return False
    
    def add_role_permission(self, role_name: str, permission: str) -> bool:
        if role_name not in self.roles:
            return False
        
        self.roles[role_name].add_permission(permission)
        
        for user in self.users.values():
            if user.role == role_name:
                user.permissions.add(permission)
        
        self._save_to_storage()
        return True
    
    def remove_role_permission(self, role_name: str, permission: str) -> bool:
        if role_name not in self.roles:
            return False
        
        self.roles[role_name].remove_permission(permission)
        
        for user in self.users.values():
            if user.role == role_name and permission in user.permissions:
                user.permissions.remove(permission)
        
        self._save_to_storage()
        return True
    
    def list_users(self) -> List[Dict[str, Any]]:
        return [
            {
                "user_id": u.user_id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at,
                "last_login": u.last_login
            }
            for u in self.users.values()
        ]
    
    def list_roles(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": r.name,
                "description": r.description,
                "permissions": list(r.permissions)
            }
            for r in self.roles.values()
        ]
    
    def _save_to_storage(self):
        if not self.storage_path:
            return
        
        data = {
            "users": {uid: u.to_dict() for uid, u in self.users.items()},
            "roles": {rname: r.to_dict() for rname, r in self.roles.items()},
            "data_permissions": {
                did: {uid: dp.to_dict() for uid, dp in perms.items()}
                for did, perms in self.data_permissions.items()
            }
        }
        
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_from_storage(self):
        if not self.storage_path or not os.path.exists(self.storage_path):
            return
        
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            for uid, user_data in data.get("users", {}).items():
                self.users[uid] = User.from_dict(user_data)
            
            for rname, role_data in data.get("roles", {}).items():
                if rname not in self.roles:
                    self.roles[rname] = Role.from_dict(role_data)
            
            for did, perms_data in data.get("data_permissions", {}).items():
                self.data_permissions[did] = {}
                for uid, dp_data in perms_data.items():
                    self.data_permissions[did][uid] = DataPermission(
                        dataset_id=did,
                        user_id=uid,
                        can_read=dp_data.get("can_read", False),
                        can_write=dp_data.get("can_write", False),
                        can_analyze=dp_data.get("can_analyze", False),
                        can_export=dp_data.get("can_export", False)
                    )
        except Exception as e:
            print(f"加载RBAC数据失败: {e}")


class PermissionDecorator:
    def __init__(self, rbac_manager: RBACManager):
        self.rbac = rbac_manager
    
    def require_permission(self, permission: str):
        def decorator(func):
            def wrapper(user_id: str, *args, **kwargs):
                if not self.rbac.has_permission(user_id, permission):
                    raise PermissionError(f"用户 {user_id} 没有权限: {permission}")
                return func(user_id, *args, **kwargs)
            return wrapper
        return decorator
    
    def require_data_permission(self, action: str):
        def decorator(func):
            def wrapper(user_id: str, dataset_id: str, *args, **kwargs):
                if not self.rbac.check_data_permission(dataset_id, user_id, action):
                    raise PermissionError(f"用户 {user_id} 没有数据集 {dataset_id} 的 {action} 权限")
                return func(user_id, dataset_id, *args, **kwargs)
            return wrapper
        return decorator
