from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: EmailStr
    avatar: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    email: Optional[str] = None


class StitchStepBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="步骤标题")
    description: Optional[str] = Field("", description="步骤描述")
    image_url: Optional[str] = Field("", max_length=500, description="步骤图片URL")
    video_url: Optional[str] = Field("", max_length=500, description="步骤视频URL")
    tips: Optional[str] = Field("", description="步骤技巧提示")
    order: int = Field(1, ge=1, description="步骤顺序")


class StitchStepCreate(StitchStepBase):
    pass


class StitchStepUpdate(StitchStepBase):
    id: Optional[int] = None


class StitchStepResponse(StitchStepBase):
    id: int
    stitch_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class StitchHistoryBase(BaseModel):
    version: int
    name: str
    description: Optional[str] = ""
    category: Optional[str] = ""
    difficulty: Optional[str] = ""
    image_url: Optional[str] = ""
    video_url: Optional[str] = ""
    steps_text: Optional[str] = ""
    materials: Optional[str] = ""
    tips: Optional[str] = ""
    change_note: Optional[str] = ""


class StitchHistoryCreate(StitchHistoryBase):
    pass


class StitchHistoryResponse(StitchHistoryBase):
    id: int
    stitch_id: int
    created_at: datetime
    changed_by_id: Optional[int] = None
    steps_data: Optional[List[dict]] = None

    class Config:
        orm_mode = True


class StitchBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="针法名称")
    description: Optional[str] = Field("", max_length=2000, description="针法描述")
    category: Optional[str] = Field("其他", max_length=50, description="针法分类")
    difficulty: Optional[str] = Field("入门", max_length=20, description="难度等级")
    image_url: Optional[str] = Field("", max_length=500, description="图片URL")
    video_url: Optional[str] = Field("", max_length=500, description="视频URL")
    steps_text: Optional[str] = Field("", description="操作步骤文本")
    materials: Optional[str] = Field("", description="所需材料")
    tips: Optional[str] = Field("", description="技巧提示")
    is_public: bool = Field(True, description="是否公开")

    @validator('name')
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('针法名称不能为空')
        return v.strip()

    @validator('description', 'steps_text', 'materials', 'tips', pre=True)
    def empty_str_to_default(cls, v):
        if v is None:
            return ""
        return v

    @validator('category', 'difficulty', 'image_url', 'video_url', pre=True)
    def none_to_empty_str(cls, v):
        if v is None:
            return ""
        return v


class StitchCreate(StitchBase):
    steps: Optional[List[StitchStepCreate]] = Field([], description="针法步骤列表")


class StitchUpdate(StitchBase):
    steps: Optional[List[StitchStepUpdate]] = Field(None, description="针法步骤列表")


class StitchResponse(StitchBase):
    id: int
    created_at: datetime
    updated_at: datetime
    owner_id: int
    view_count: int = 0
    owner: UserResponse
    steps: List[StitchStepResponse] = []

    class Config:
        orm_mode = True


class WorkBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    stitch_id: Optional[int] = None


class WorkCreate(WorkBase):
    pass


class WorkUpdate(WorkBase):
    pass


class WorkResponse(WorkBase):
    id: int
    created_at: datetime
    owner_id: int
    likes_count: int
    shares_count: int
    owner: UserResponse
    stitch: Optional[StitchResponse]

    class Config:
        orm_mode = True


class CommentBase(BaseModel):
    content: str
    parent_id: Optional[int] = None


class CommentCreate(CommentBase):
    work_id: int


class CommentResponse(CommentBase):
    id: int
    created_at: datetime
    user_id: int
    work_id: int
    user: UserResponse

    class Config:
        orm_mode = True
