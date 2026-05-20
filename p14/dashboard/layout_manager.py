import json
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import os


class LayoutItem:
    """单个布局项"""

    def __init__(self, chart_id: str, chart_type: str,
                 x: int = 0, y: int = 0, width: int = 6, height: int = 4,
                 config: Dict[str, Any] = None):
        self.chart_id = chart_id
        self.chart_type = chart_type
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.config = config or {}
        self.visible = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            'chart_id': self.chart_id,
            'chart_type': self.chart_type,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height,
            'config': self.config,
            'visible': self.visible
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LayoutItem':
        return cls(
            chart_id=data['chart_id'],
            chart_type=data['chart_type'],
            x=data.get('x', 0),
            y=data.get('y', 0),
            width=data.get('width', 6),
            height=data.get('height', 4),
            config=data.get('config', {}),
            visible=data.get('visible', True)
        )


class DashboardLayout:
    """仪表板布局定义"""

    def __init__(self, name: str = "默认布局", columns: int = 12,
                 row_height: int = 50, margin: Tuple[int, int] = (10, 10)):
        self.layout_id = str(uuid.uuid4())[:8]
        self.name = name
        self.columns = columns
        self.row_height = row_height
        self.margin = margin
        self.items: List[LayoutItem] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.is_default = False

    def add_item(self, item: LayoutItem):
        """添加布局项"""
        self.items.append(item)
        self.updated_at = datetime.now()

    def remove_item(self, chart_id: str):
        """移除布局项"""
        self.items = [item for item in self.items if item.chart_id != chart_id]
        self.updated_at = datetime.now()

    def update_item(self, chart_id: str, **kwargs):
        """更新布局项"""
        for item in self.items:
            if item.chart_id == chart_id:
                for key, value in kwargs.items():
                    if hasattr(item, key):
                        setattr(item, key, value)
                self.updated_at = datetime.now()
                break

    def reorder_items(self):
        """自动重排，避免重叠"""
        # 简单的自上而下排列
        current_y = 0
        for item in sorted(self.items, key=lambda x: (x.y, x.x)):
            item.y = current_y
            current_y += item.height + 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            'layout_id': self.layout_id,
            'name': self.name,
            'columns': self.columns,
            'row_height': self.row_height,
            'margin': self.margin,
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_default': self.is_default
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DashboardLayout':
        layout = cls(
            name=data.get('name', '导入布局'),
            columns=data.get('columns', 12),
            row_height=data.get('row_height', 50),
            margin=tuple(data.get('margin', (10, 10)))
        )
        layout.layout_id = data.get('layout_id', layout.layout_id)
        layout.items = [LayoutItem.from_dict(item_data)
                       for item_data in data.get('items', [])]
        layout.created_at = datetime.fromisoformat(data.get('created_at', datetime.now().isoformat()))
        layout.updated_at = datetime.fromisoformat(data.get('updated_at', datetime.now().isoformat()))
        layout.is_default = data.get('is_default', False)
        return layout


class LayoutManager:
    """布局管理器 - 处理保存、加载、切换"""

    def __init__(self, storage_path: str = None):
        self.storage_path = storage_path or os.path.expanduser("~/.dash_dashboard/layouts")
        self.layouts: Dict[str, DashboardLayout] = {}
        self.current_layout_id: Optional[str] = None
        self._init_storage()
        self._load_layouts()

    def _init_storage(self):
        """初始化存储目录"""
        os.makedirs(self.storage_path, exist_ok=True)

    def _load_layouts(self):
        """加载所有保存的布局"""
        for filename in os.listdir(self.storage_path):
            if filename.endswith('.json'):
                filepath = os.path.join(self.storage_path, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        layout = DashboardLayout.from_dict(data)
                        self.layouts[layout.layout_id] = layout
                except Exception as e:
                    print(f"加载布局失败 {filename}: {e}")

    def _save_layout_file(self, layout: DashboardLayout):
        """保存布局到文件"""
        filepath = os.path.join(self.storage_path, f"{layout.layout_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(layout.to_dict(), f, ensure_ascii=False, indent=2)

    def create_layout(self, name: str = "新布局") -> DashboardLayout:
        """创建新布局"""
        layout = DashboardLayout(name=name)
        self.layouts[layout.layout_id] = layout
        self._save_layout_file(layout)
        return layout

    def save_layout(self, layout: DashboardLayout) -> bool:
        """保存布局"""
        layout.updated_at = datetime.now()
        self.layouts[layout.layout_id] = layout
        self._save_layout_file(layout)
        return True

    def get_layout(self, layout_id: str) -> Optional[DashboardLayout]:
        """获取指定布局"""
        return self.layouts.get(layout_id)

    def list_layouts(self) -> List[Dict[str, Any]]:
        """列出所有布局"""
        return [
            {
                'layout_id': layout.layout_id,
                'name': layout.name,
                'chart_count': len(layout.items),
                'updated_at': layout.updated_at.isoformat(),
                'is_default': layout.is_default
            }
            for layout in self.layouts.values()
        ]

    def delete_layout(self, layout_id: str) -> bool:
        """删除布局"""
        if layout_id in self.layouts:
            del self.layouts[layout_id]
            filepath = os.path.join(self.storage_path, f"{layout_id}.json")
            if os.path.exists(filepath):
                os.remove(filepath)
            return True
        return False

    def duplicate_layout(self, layout_id: str, new_name: str = None) -> Optional[DashboardLayout]:
        """复制布局"""
        if layout_id not in self.layouts:
            return None

        original = self.layouts[layout_id]
        new_layout = DashboardLayout.from_dict(original.to_dict())
        new_layout.layout_id = str(uuid.uuid4())[:8]
        new_layout.name = new_name or f"{original.name} (副本)"
        new_layout.created_at = datetime.now()
        new_layout.updated_at = datetime.now()
        new_layout.is_default = False

        self.layouts[new_layout.layout_id] = new_layout
        self._save_layout_file(new_layout)
        return new_layout

    def set_default_layout(self, layout_id: str) -> bool:
        """设置默认布局"""
        if layout_id not in self.layouts:
            return False

        for layout in self.layouts.values():
            layout.is_default = False

        self.layouts[layout_id].is_default = True
        for layout in self.layouts.values():
            self._save_layout_file(layout)

        return True

    def get_default_layout(self) -> Optional[DashboardLayout]:
        """获取默认布局"""
        for layout in self.layouts.values():
            if layout.is_default:
                return layout
        return None

    def export_layout(self, layout_id: str, export_path: str) -> bool:
        """导出布局"""
        layout = self.layouts.get(layout_id)
        if not layout:
            return False

        try:
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(layout.to_dict(), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"导出布局失败: {e}")
            return False

    def import_layout(self, import_path: str) -> Optional[DashboardLayout]:
        """导入布局"""
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                layout = DashboardLayout.from_dict(data)
                layout.layout_id = str(uuid.uuid4())[:8]
                self.layouts[layout.layout_id] = layout
                self._save_layout_file(layout)
                return layout
        except Exception as e:
            print(f"导入布局失败: {e}")
            return None

    def generate_grid_layout(self, chart_configs: List[Dict[str, Any]],
                            cols_per_row: int = 2) -> DashboardLayout:
        """自动生成网格布局"""
        layout = self.create_layout("自动生成网格")
        for i, config in enumerate(chart_configs):
            row = i // cols_per_row
            col = i % cols_per_row
            item = LayoutItem(
                chart_id=config.get('id', f"chart_{i}"),
                chart_type=config.get('type', 'scatter'),
                x=col * (12 // cols_per_row),
                y=row * 4,
                width=12 // cols_per_row,
                height=4,
                config=config
            )
            layout.add_item(item)
        self.save_layout(layout)
        return layout


# 预定义模板布局
TEMPLATES = {
    '2x2': [
        {'x': 0, 'y': 0, 'width': 6, 'height': 4},
        {'x': 6, 'y': 0, 'width': 6, 'height': 4},
        {'x': 0, 'y': 4, 'width': 6, 'height': 4},
        {'x': 6, 'y': 4, 'width': 6, 'height': 4},
    ],
    '1+2': [
        {'x': 0, 'y': 0, 'width': 12, 'height': 4},
        {'x': 0, 'y': 4, 'width': 6, 'height': 4},
        {'x': 6, 'y': 4, 'width': 6, 'height': 4},
    ],
    'sidebar': [
        {'x': 0, 'y': 0, 'width': 4, 'height': 8},
        {'x': 4, 'y': 0, 'width': 8, 'height': 4},
        {'x': 4, 'y': 4, 'width': 8, 'height': 4},
    ],
    '3_row': [
        {'x': 0, 'y': 0, 'width': 12, 'height': 3},
        {'x': 0, 'y': 3, 'width': 12, 'height': 3},
        {'x': 0, 'y': 6, 'width': 12, 'height': 3},
    ],
}


def create_template_layout(template_name: str, charts: List[Dict[str, Any]],
                          name: str = None) -> DashboardLayout:
    """从模板创建布局"""
    template = TEMPLATES.get(template_name)
    if not template:
        raise ValueError(f"未知模板: {template_name}")

    layout = DashboardLayout(name=name or f"{template_name} 模板")

    for i, chart in enumerate(charts[:len(template)]):
        config = template[i]
        item = LayoutItem(
            chart_id=chart.get('id', f"chart_{i}"),
            chart_type=chart.get('type', 'scatter'),
            x=config['x'],
            y=config['y'],
            width=config['width'],
            height=config['height'],
            config=chart
        )
        layout.add_item(item)

    return layout
