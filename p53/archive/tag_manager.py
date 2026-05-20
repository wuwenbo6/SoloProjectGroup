from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker
from typing import Dict, List, Optional, Set
from datetime import datetime
import json
import os
from dataclasses import dataclass, asdict


@dataclass
class Tag:
    tag_id: str
    name: str
    color: str = "#3498db"
    description: str = ""
    created_at: str = ""
    document_count: int = 0
    
    def to_dict(self) -> Dict:
        return asdict(self)
        
    @classmethod
    def from_dict(cls, data: Dict) -> 'Tag':
        return cls(
            tag_id=data.get("tag_id", ""),
            name=data.get("name", ""),
            color=data.get("color", "#3498db"),
            description=data.get("description", ""),
            created_at=data.get("created_at", ""),
            document_count=data.get("document_count", 0)
        )


class TagManager(QObject):
    tag_created = pyqtSignal(Tag)
    tag_updated = pyqtSignal(Tag)
    tag_deleted = pyqtSignal(str)
    tags_assigned = pyqtSignal(str, list)
    tags_removed = pyqtSignal(str, list)
    
    def __init__(self, storage_path: str = None):
        super().__init__()
        self.mutex = QMutex()
        self.tags: Dict[str, Tag] = {}
        self.document_tags: Dict[str, Set[str]] = {}
        
        if storage_path is None:
            home = os.path.expanduser("~")
            storage_path = os.path.join(home, ".typewriter_digitizer", "tags")
        
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        self._load_tags()
        
    def create_tag(self, name: str, color: str = "#3498db", description: str = "") -> Optional[Tag]:
        locker = QMutexLocker(self.mutex)
        
        for tag in self.tags.values():
            if tag.name == name:
                return None
        
        tag_id = f"tag_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        tag = Tag(
            tag_id=tag_id,
            name=name,
            color=color,
            description=description,
            created_at=datetime.now().isoformat()
        )
        
        self.tags[tag_id] = tag
        self._save_tags()
        self.tag_created.emit(tag)
        return tag
        
    def update_tag(self, tag_id: str, name: str = None, color: str = None, description: str = None) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if tag_id not in self.tags:
            return False
            
        tag = self.tags[tag_id]
        
        if name:
            tag.name = name
        if color:
            tag.color = color
        if description:
            tag.description = description
            
        self._save_tags()
        self.tag_updated.emit(tag)
        return True
        
    def delete_tag(self, tag_id: str, delete_from_documents: bool = True) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if tag_id not in self.tags:
            return False
            
        del self.tags[tag_id]
        
        if delete_from_documents:
            for doc_tags in self.document_tags.values():
                if tag_id in doc_tags:
                    doc_tags.remove(tag_id)
                    
        self._save_tags()
        self.tag_deleted.emit(tag_id)
        return True
        
    def get_tag(self, tag_id: str) -> Optional[Tag]:
        locker = QMutexLocker(self.mutex)
        return self.tags.get(tag_id)
        
    def get_all_tags(self) -> List[Tag]:
        locker = QMutexLocker(self.mutex)
        return list(self.tags.values())
        
    def get_tag_names(self) -> List[str]:
        locker = QMutexLocker(self.mutex)
        return [tag.name for tag in self.tags.values()]
        
    def assign_tags_to_document(self, document_id: str, tag_ids: List[str]) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if document_id not in self.document_tags:
            self.document_tags[document_id] = set()
            
        for tag_id in tag_ids:
            if tag_id in self.tags:
                self.document_tags[document_id].add(tag_id)
                self.tags[tag_id].document_count += 1
                
        self._save_tags()
        self.tags_assigned.emit(document_id, tag_ids)
        return True
        
    def remove_tags_from_document(self, document_id: str, tag_ids: List[str]) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if document_id not in self.document_tags:
            return False
            
        for tag_id in tag_ids:
            if tag_id in self.document_tags[document_id]:
                self.document_tags[document_id].remove(tag_id)
                if tag_id in self.tags:
                    self.tags[tag_id].document_count -= 1
                    
        self._save_tags()
        self.tags_removed.emit(document_id, tag_ids)
        return True
        
    def get_document_tags(self, document_id: str) -> List[Tag]:
        locker = QMutexLocker(self.mutex)
        
        if document_id not in self.document_tags:
            return []
            
        tags = []
        for tag_id in self.document_tags[document_id]:
            if tag_id in self.tags:
                tags.append(self.tags[tag_id])
        return tags
        
    def get_documents_by_tag(self, tag_id: str) -> List[str]:
        locker = QMutexLocker(self.mutex)
        
        documents = []
        for doc_id, tags in self.document_tags.items():
            if tag_id in tags:
                documents.append(doc_id)
        return documents
        
    def search_tags(self, query: str) -> List[Tag]:
        locker = QMutexLocker(self.mutex)
        
        results = []
        query = query.lower()
        
        for tag in self.tags.values():
            if (query in tag.name.lower() or
                query in tag.description.lower()):
                results.append(tag)
                
        return results
        
    def get_cloud_tags(self) -> List[Dict]:
        locker = QMutexLocker(self.mutex)
        
        tags = []
        for tag in self.tags.values():
            if tag.document_count > 0:
                tags.append({
                    "tag": tag,
                    "count": tag.document_count
                })
                
        tags.sort(key=lambda x: x["count"], reverse=True)
        return tags
        
    def merge_tags(self, source_tag_ids: List[str], target_tag_id: str) -> bool:
        locker = QMutexLocker(self.mutex)
        
        if target_tag_id not in self.tags:
            return False
            
        target_tag = self.tags[target_tag_id]
        
        for source_id in source_tag_ids:
            if source_id not in self.tags:
                continue
                
            for doc_id, tags in self.document_tags.items():
                if source_id in tags:
                    tags.remove(source_id)
                    tags.add(target_tag_id)
                    target_tag.document_count += 1
                    
            del self.tags[source_id]
            self.tag_deleted.emit(source_id)
            
        self._save_tags()
        self.tag_updated.emit(target_tag)
        return True
        
    def get_statistics(self) -> Dict:
        locker = QMutexLocker(self.mutex)
        
        tagged_documents = sum(1 for tags in self.document_tags.values() if tags)
        
        return {
            "total_tags": len(self.tags),
            "tagged_documents": tagged_documents,
            "total_assignments": sum(len(tags) for tags in self.document_tags.values()),
            "most_popular": max(self.tags.values(), key=lambda t: t.document_count).name if self.tags else None,
            "least_popular": min(self.tags.values(), key=lambda t: t.document_count).name if self.tags else None
        }
        
    def _save_tags(self):
        try:
            data = {
                "tags": {tag_id: tag.to_dict() for tag_id, tag in self.tags.items()},
                "document_tags": {doc_id: list(tags) for doc_id, tags in self.document_tags.items()}
            }
            
            file_path = os.path.join(self.storage_path, "tags.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存标签失败: {e}")
            
    def _load_tags(self):
        try:
            file_path = os.path.join(self.storage_path, "tags.json")
            if not os.path.exists(file_path):
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            for tag_id, tag_data in data.get("tags", {}).items():
                self.tags[tag_id] = Tag.from_dict(tag_data)
                
            for doc_id, tag_ids in data.get("document_tags", {}).items():
                self.document_tags[doc_id] = set(tag_ids)
                
        except Exception as e:
            print(f"加载标签失败: {e}")
