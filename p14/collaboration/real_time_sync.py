import json
import uuid
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable, Set
from enum import Enum
from collections import deque


class UserStatus(Enum):
    """用户状态"""
    ONLINE = "online"
    OFFLINE = "offline"
    AWAY = "away"
    BUSY = "busy"


class ChangeType(Enum):
    """变更类型"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MOVE = "move"
    RESIZE = "resize"


class User:
    """用户信息"""

    def __init__(self, user_id: str, username: str, avatar: str = None):
        self.user_id = user_id
        self.username = username
        self.avatar = avatar or f"https://api.dicebear.com/7.x/initials/svg?seed={username}"
        self.status = UserStatus.ONLINE
        self.joined_at = datetime.now().isoformat()
        self.last_active = datetime.now().isoformat()
        self.current_project: Optional[str] = None
        self.current_view: Optional[str] = None
        self.cursor_position: Optional[Dict[str, Any]] = None
        self.selections: List[str] = []  # 当前选中的元素ID

    def to_dict(self) -> Dict[str, Any]:
        return {
            'user_id': self.user_id,
            'username': self.username,
            'avatar': self.avatar,
            'status': self.status.value,
            'joined_at': self.joined_at,
            'last_active': self.last_active,
            'current_project': self.current_project,
            'current_view': self.current_view,
            'cursor_position': self.cursor_position,
            'selections': self.selections
        }


class ChangeOperation:
    """变更操作"""

    def __init__(self, user_id: str, project_id: str,
                 change_type: ChangeType, target_type: str,
                 target_id: str, data: Dict[str, Any]):
        self.operation_id = str(uuid.uuid4())
        self.user_id = user_id
        self.project_id = project_id
        self.change_type = change_type
        self.target_type = target_type
        self.target_id = target_id
        self.data = data
        self.timestamp = datetime.now().isoformat()
        self.version = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'operation_id': self.operation_id,
            'user_id': self.user_id,
            'project_id': self.project_id,
            'change_type': self.change_type.value,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'data': self.data,
            'timestamp': self.timestamp,
            'version': self.version
        }


class Project:
    """协作项目"""

    def __init__(self, project_id: str, name: str, owner_id: str):
        self.project_id = project_id
        self.name = name
        self.owner_id = owner_id
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self.collaborators: Set[str] = {owner_id}  # 协作用户ID集合
        self.editors: Set[str] = set()  # 当前正在编辑的用户
        self.viewers: Set[str] = set()  # 当前正在查看的用户
        self.version = 1
        self.snapshots: List[Dict[str, Any]] = []  # 历史快照
        self.change_history: deque = deque(maxlen=1000)  # 变更历史
        self.data: Dict[str, Any] = {}  # 项目数据

    def add_collaborator(self, user_id: str) -> bool:
        """添加协作者"""
        if user_id not in self.collaborators:
            self.collaborators.add(user_id)
            return True
        return False

    def remove_collaborator(self, user_id: str) -> bool:
        """移除协作者"""
        if user_id in self.collaborators and user_id != self.owner_id:
            self.collaborators.remove(user_id)
            return True
        return False

    def user_join_edit(self, user_id: str) -> bool:
        """用户进入编辑模式"""
        if user_id in self.collaborators:
            self.editors.add(user_id)
            self.viewers.discard(user_id)
            return True
        return False

    def user_join_view(self, user_id: str) -> bool:
        """用户进入查看模式"""
        if user_id in self.collaborators:
            self.viewers.add(user_id)
            self.editors.discard(user_id)
            return True
        return False

    def user_leave(self, user_id: str):
        """用户离开项目"""
        self.editors.discard(user_id)
        self.viewers.discard(user_id)

    def apply_change(self, change: ChangeOperation) -> bool:
        """应用变更操作"""
        if change.user_id not in self.editors:
            return False

        self.change_history.append(change)
        self.version += 1
        self.updated_at = datetime.now().isoformat()
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            'project_id': self.project_id,
            'name': self.name,
            'owner_id': self.owner_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'collaborators_count': len(self.collaborators),
            'editors_count': len(self.editors),
            'viewers_count': len(self.viewers),
            'version': self.version,
            'change_count': len(self.change_history)
        }


class PresenceManager:
    """在线状态管理器"""

    def __init__(self):
        self.online_users: Dict[str, User] = {}
        self.project_users: Dict[str, Set[str]] = {}  # project_id -> user_ids

    def user_connected(self, user: User) -> bool:
        """用户连接"""
        if user.user_id in self.online_users:
            return False
        self.online_users[user.user_id] = user
        return True

    def user_disconnected(self, user_id: str) -> Optional[User]:
        """用户断开连接"""
        return self.online_users.pop(user_id, None)

    def user_joined_project(self, user_id: str, project_id: str) -> bool:
        """用户加入项目"""
        if user_id not in self.online_users:
            return False
        if project_id not in self.project_users:
            self.project_users[project_id] = set()
        self.project_users[project_id].add(user_id)
        self.online_users[user_id].current_project = project_id
        self.online_users[user_id].last_active = datetime.now().isoformat()
        return True

    def user_left_project(self, user_id: str, project_id: str) -> bool:
        """用户离开项目"""
        if project_id in self.project_users:
            self.project_users[project_id].discard(user_id)
        if user_id in self.online_users:
            self.online_users[user_id].current_project = None
            self.online_users[user_id].last_active = datetime.now().isoformat()
        return True

    def update_user_activity(self, user_id: str, view: str = None,
                             cursor_pos: Dict = None, selections: List[str] = None):
        """更新用户活动状态"""
        if user_id in self.online_users:
            user = self.online_users[user_id]
            user.last_active = datetime.now().isoformat()
            if view is not None:
                user.current_view = view
            if cursor_pos is not None:
                user.cursor_position = cursor_pos
            if selections is not None:
                user.selections = selections

    def get_project_users(self, project_id: str) -> List[User]:
        """获取项目的在线用户"""
        user_ids = self.project_users.get(project_id, set())
        return [self.online_users[uid] for uid in user_ids if uid in self.online_users]

    def get_online_users_count(self) -> int:
        """获取在线用户总数"""
        return len(self.online_users)


class OTConflictResolver:
    """操作转换(OT)冲突解决器"""

    def __init__(self):
        self.conflict_resolution_rules = {
            'concurrent_update': 'last_write_wins',
            'delete_then_update': 'reject_update',
            'update_then_delete': 'allow_delete'
        }

    def resolve_conflict(self, local_op: ChangeOperation,
                         remote_op: ChangeOperation) -> Optional[ChangeOperation]:
        """解决两个操作的冲突"""
        if local_op.target_id != remote_op.target_id:
            return remote_op  # 不同目标，无冲突

        # 相同目标的冲突处理
        if (local_op.change_type == ChangeType.DELETE and
            remote_op.change_type == ChangeType.UPDATE):
            return None  # 删除后不再处理更新

        if (local_op.change_type == ChangeType.UPDATE and
            remote_op.change_type == ChangeType.DELETE):
            return remote_op  # 更新后允许删除

        # 默认为最后写入获胜
        if local_op.timestamp < remote_op.timestamp:
            return remote_op
        return local_op


class RealTimeSyncServer:
    """实时同步服务器"""

    def __init__(self):
        self.projects: Dict[str, Project] = {}
        self.users: Dict[str, User] = {}
        self.presence = PresenceManager()
        self.conflict_resolver = OTConflictResolver()
        self.subscribers: Dict[str, List[Callable]] = {}  # project_id -> callbacks
        self.broadcast_thread: Optional[threading.Thread] = None
        self.running = False
        self.event_queue: deque = deque(maxlen=1000)

    def create_project(self, name: str, owner_id: str) -> Project:
        """创建新项目"""
        project_id = str(uuid.uuid4())
        project = Project(project_id, name, owner_id)
        self.projects[project_id] = project

        # 确保用户存在
        if owner_id not in self.users:
            self.users[owner_id] = User(owner_id, f"User_{owner_id[:8]}")

        return project

    def add_user(self, user: User):
        """添加用户"""
        self.users[user.user_id] = user

    def user_join_project(self, user_id: str, project_id: str,
                          edit_mode: bool = True) -> bool:
        """用户加入项目"""
        if project_id not in self.projects:
            return False
        if user_id not in self.users:
            return False

        project = self.projects[project_id]
        if user_id not in project.collaborators:
            return False  # 不是协作者

        # 更新在线状态
        self.presence.user_connected(self.users[user_id])
        self.presence.user_joined_project(user_id, project_id)

        if edit_mode:
            project.user_join_edit(user_id)
        else:
            project.user_join_view(user_id)

        self._broadcast_presence(project_id)
        return True

    def user_leave_project(self, user_id: str, project_id: str):
        """用户离开项目"""
        if project_id in self.projects:
            self.projects[project_id].user_leave(user_id)
        self.presence.user_left_project(user_id, project_id)
        self._broadcast_presence(project_id)

    def submit_change(self, user_id: str, project_id: str,
                      change_type: ChangeType, target_type: str,
                      target_id: str, data: Dict[str, Any]) -> Optional[ChangeOperation]:
        """提交变更操作"""
        if project_id not in self.projects:
            return None

        project = self.projects[project_id]
        if user_id not in project.editors:
            return None

        # 创建操作
        change = ChangeOperation(user_id, project_id, change_type, target_type, target_id, data)

        # 应用变更
        if project.apply_change(change):
            # 广播变更
            self._broadcast_change(project_id, change)
            return change

        return None

    def subscribe_project(self, project_id: str, callback: Callable[[Dict], None]):
        """订阅项目变更"""
        if project_id not in self.subscribers:
            self.subscribers[project_id] = []
        self.subscribers[project_id].append(callback)

    def _broadcast_change(self, project_id: str, change: ChangeOperation):
        """广播变更给所有订阅者"""
        if project_id not in self.subscribers:
            return

        message = {
            'type': 'change',
            'project_id': project_id,
            'change': change.to_dict()
        }

        for callback in self.subscribers[project_id]:
            try:
                callback(message)
            except Exception as e:
                print(f"❌ 广播回调执行失败: {e}")

    def _broadcast_presence(self, project_id: str):
        """广播用户在线状态变更"""
        if project_id not in self.subscribers:
            return

        users = self.presence.get_project_users(project_id)
        message = {
            'type': 'presence',
            'project_id': project_id,
            'users': [u.to_dict() for u in users]
        }

        for callback in self.subscribers[project_id]:
            try:
                callback(message)
            except Exception as e:
                print(f"❌ 在线状态广播失败: {e}")

    def get_project_state(self, project_id: str) -> Optional[Dict]:
        """获取项目完整状态"""
        if project_id not in self.projects:
            return None

        project = self.projects[project_id]
        users = self.presence.get_project_users(project_id)

        return {
            'project': project.to_dict(),
            'users': [u.to_dict() for u in users],
            'recent_changes': [c.to_dict() for c in list(project.change_history)[-50:]],
            'data': project.data
        }

    def get_collaborator_projects(self, user_id: str) -> List[Project]:
        """获取用户参与的所有项目"""
        return [
            p for p in self.projects.values()
            if user_id in p.collaborators
        ]

    def start(self):
        """启动同步服务器"""
        self.running = True
        print("✅ 实时同步服务器已启动")

    def stop(self):
        """停止同步服务器"""
        self.running = False
        print("✅ 实时同步服务器已停止")


class RealTimeClient:
    """实时同步客户端"""

    def __init__(self, server: RealTimeSyncServer, user_id: str):
        self.server = server
        self.user_id = user_id
        self.current_project: Optional[str] = None
        self.pending_changes: List[ChangeOperation] = []
        self.received_changes: List[ChangeOperation] = []
        self.on_change_callbacks: List[Callable] = []
        self.on_presence_callbacks: List[Callable] = []

    def join_project(self, project_id: str, edit_mode: bool = True) -> bool:
        """加入项目"""
        if self.server.user_join_project(self.user_id, project_id, edit_mode):
            self.current_project = project_id
            self.server.subscribe_project(project_id, self._on_server_message)
            return True
        return False

    def leave_project(self):
        """离开当前项目"""
        if self.current_project:
            self.server.user_leave_project(self.user_id, self.current_project)
            self.current_project = None

    def send_change(self, change_type: ChangeType, target_type: str,
                    target_id: str, data: Dict[str, Any]) -> bool:
        """发送变更"""
        if not self.current_project:
            return False

        result = self.server.submit_change(
            self.user_id, self.current_project,
            change_type, target_type, target_id, data
        )
        return result is not None

    def _on_server_message(self, message: Dict):
        """处理服务器消息"""
        msg_type = message.get('type')

        if msg_type == 'change':
            change_data = message.get('change', {})
            self.received_changes.append(change_data)
            for callback in self.on_change_callbacks:
                try:
                    callback(change_data)
                except Exception as e:
                    print(f"❌ 变更回调执行失败: {e}")

        elif msg_type == 'presence':
            users = message.get('users', [])
            for callback in self.on_presence_callbacks:
                try:
                    callback(users)
                except Exception as e:
                    print(f"❌ 在线状态回调执行失败: {e}")

    def on_change(self, callback: Callable):
        """注册变更回调"""
        self.on_change_callbacks.append(callback)

    def on_presence_change(self, callback: Callable):
        """注册在线状态变更回调"""
        self.on_presence_callbacks.append(callback)

    def get_current_state(self) -> Optional[Dict]:
        """获取当前项目状态"""
        if not self.current_project:
            return None
        return self.server.get_project_state(self.current_project)


def create_collaboration_demo() -> tuple:
    """创建协作演示环境"""
    server = RealTimeSyncServer()
    server.start()

    # 创建用户
    user1 = User("user_001", "Alice")
    user2 = User("user_002", "Bob")
    user3 = User("user_003", "Charlie")

    server.add_user(user1)
    server.add_user(user2)
    server.add_user(user3)

    # 创建项目
    project = server.create_project("销售数据分析仪表板", "user_001")
    project.add_collaborator("user_002")
    project.add_collaborator("user_003")

    # 初始化项目数据
    project.data = {
        'title': '销售数据分析仪表板',
        'charts': [
            {'id': 'chart_001', 'type': 'line', 'title': '月度销售额'},
            {'id': 'chart_002', 'type': 'bar', 'title': '区域对比'},
        ],
        'layout': {
            'grid_cols': 12,
            'gap': 16
        }
    }

    return server, project


if __name__ == "__main__":
    # 实时协作演示
    print("\n🚀 实时协作系统演示")
    print("=" * 50)

    server, project = create_collaboration_demo()
    project_id = project.project_id

    # 创建客户端
    client1 = RealTimeClient(server, "user_001")
    client2 = RealTimeClient(server, "user_002")
    client3 = RealTimeClient(server, "user_003")

    # 注册回调
    def on_change1(change):
        print(f"\n📥 Alice 收到变更: {change['change_type']} on {change['target_type']}")
        print(f"   数据: {change['data']}")

    def on_presence1(users):
        print(f"\n👥 Alice 看到在线用户: {[u['username'] for u in users]}")

    def on_change2(change):
        print(f"\n📥 Bob 收到变更: {change['change_type']} on {change['target_type']}")
        print(f"   数据: {change['data']}")

    def on_presence2(users):
        print(f"\n👥 Bob 看到在线用户: {[u['username'] for u in users]}")

    client1.on_change(on_change1)
    client1.on_presence_change(on_presence1)
    client2.on_change(on_change2)
    client2.on_presence_change(on_presence2)

    print("\n用户加入项目...")
    client1.join_project(project_id, edit_mode=True)
    client2.join_project(project_id, edit_mode=True)
    client3.join_project(project_id, edit_mode=False)

    time.sleep(0.5)

    print("\n📝 Alice 提交变更...")
    client1.send_change(
        ChangeType.UPDATE,
        "chart",
        "chart_001",
        {"title": "月度销售额（更新）", "color": "blue"}
    )

    time.sleep(0.5)

    print("\n📝 Bob 提交变更...")
    client2.send_change(
        ChangeType.CREATE,
        "chart",
        "chart_003",
        {"type": "pie", "title": "产品类别占比"}
    )

    time.sleep(0.5)

    state = client1.get_current_state()
    print(f"\n📊 当前项目状态:")
    print(f"   版本: {state['project']['version']}")
    print(f"   变更数: {state['project']['change_count']}")
    print(f"   编辑中: {state['project']['editors_count']} 人")
    print(f"   查看中: {state['project']['viewers_count']} 人")

    print("\n👋 用户离开...")
    client3.leave_project()
    client2.leave_project()

    time.sleep(0.5)

    state = client1.get_current_state()
    print(f"\n📊 最终项目状态:")
    print(f"   编辑中: {state['project']['editors_count']} 人")
    print(f"   查看中: {state['project']['viewers_count']} 人")

    client1.leave_project()
    server.stop()
    print("\n✅ 演示完成")
