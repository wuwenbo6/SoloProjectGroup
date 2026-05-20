from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class KeywordMonitor(BaseModel):
    keyword: str
    user_id: str
    alert_threshold: float = 0.7
    is_active: bool = True


class AlertResponse(BaseModel):
    id: str
    keyword: str
    user_id: str
    message: str
    created_at: datetime
    is_read: bool = False
