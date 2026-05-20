from pydantic import BaseModel
from typing import List, Optional


class DialectTreeNode(BaseModel):
    id: int
    name: str
    code: str
    level: int
    region: Optional[str] = None
    description: Optional[str] = None
    sample_count: int = 0
    children: List["DialectTreeNode"] = []
    expanded: bool = False

    class Config:
        from_attributes = True


DialectTreeNode.model_rebuild()


class DialectTreeStats(BaseModel):
    total_categories: int
    total_samples: int
    max_depth: int
    leaf_nodes: int
    samples_by_level: dict


class DialectCategoryDetail(DialectTreeNode):
    feature_vector: Optional[str] = None
    parent_name: Optional[str] = None
