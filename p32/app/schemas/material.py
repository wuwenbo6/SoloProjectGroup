from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class RawMaterialBase(BaseModel):
    name: str = Field(..., max_length=100, description="原料名称")
    category: str = Field(..., max_length=50, description="原料分类")
    origin_province: Optional[str] = Field(None, max_length=50, description="产地省份")
    origin_city: Optional[str] = Field(None, max_length=50, description="产地城市")
    origin_village: Optional[str] = Field(None, max_length=100, description="产地村落")
    longitude: Optional[float] = Field(None, description="经度")
    latitude: Optional[float] = Field(None, description="纬度")
    harvest_date: Optional[datetime] = Field(None, description="采集日期")
    collector: Optional[str] = Field(None, max_length=100, description="采集人")
    description: Optional[str] = Field(None, description="描述")
    craft_type: Optional[str] = Field(None, max_length=100, description="工艺类型")


class RawMaterialCreate(RawMaterialBase):
    material_code: str = Field(..., max_length=50, description="原料编号")


class RawMaterialUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=50)
    origin_province: Optional[str] = Field(None, max_length=50)
    origin_city: Optional[str] = Field(None, max_length=50)
    origin_village: Optional[str] = Field(None, max_length=100)
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    harvest_date: Optional[datetime] = None
    collector: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    craft_type: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class RawMaterialResponse(RawMaterialBase):
    id: int
    material_code: str
    created_at: datetime
    updated_at: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class OriginInfoBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    land_type: Optional[str] = Field(None, max_length=50)
    soil_composition: Optional[str] = None
    climate: Optional[str] = Field(None, max_length=200)
    altitude: Optional[float] = None
    annual_rainfall: Optional[float] = None
    planting_method: Optional[str] = Field(None, max_length=200)
    fertilizer_used: Optional[str] = None
    pest_control: Optional[str] = None
    certification: Optional[str] = Field(None, max_length=200)


class OriginInfoCreate(OriginInfoBase):
    pass


class OriginInfoResponse(OriginInfoBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingStepBase(BaseModel):
    batch_id: str = Field(..., max_length=50)
    step_order: int
    step_name: str = Field(..., max_length=100)
    operator: Optional[str] = Field(None, max_length=100)
    operation_time: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    equipment: Optional[str] = Field(None, max_length=200)
    parameters: Optional[str] = None
    notes: Optional[str] = None


class ProcessingStepCreate(ProcessingStepBase):
    pass


class ProcessingStepResponse(ProcessingStepBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
