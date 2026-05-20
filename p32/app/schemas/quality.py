from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class QualityParameterBase(BaseModel):
    parameter_name: str = Field(..., max_length=100)
    parameter_code: Optional[str] = Field(None, max_length=50)
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=30)
    standard_min: Optional[float] = None
    standard_max: Optional[float] = None
    score: Optional[float] = None
    weight: Optional[float] = None
    is_passed: Optional[bool] = True
    notes: Optional[str] = None


class QualityParameterCreate(QualityParameterBase):
    test_id: int


class QualityParameterResponse(QualityParameterBase):
    id: int

    class Config:
        from_attributes = True


class ColorTestBase(BaseModel):
    color_space: Optional[str] = Field("RGB", max_length=20)
    r_value: Optional[int] = None
    g_value: Optional[int] = None
    b_value: Optional[int] = None
    l_value: Optional[float] = None
    a_value: Optional[float] = None
    b_lab_value: Optional[float] = None
    color_name: Optional[str] = Field(None, max_length=100)
    uniformity: Optional[float] = None
    glossiness: Optional[float] = None
    score: Optional[float] = None


class ColorTestCreate(ColorTestBase):
    test_id: int
    batch_id: str


class ColorTestResponse(ColorTestBase):
    id: int
    test_id: int
    batch_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ToughnessTestBase(BaseModel):
    tensile_strength: Optional[float] = None
    elongation: Optional[float] = None
    tear_resistance: Optional[float] = None
    bending_resistance: Optional[float] = None
    impact_resistance: Optional[float] = None
    wear_resistance: Optional[float] = None
    hardness: Optional[float] = None
    score: Optional[float] = None


class ToughnessTestCreate(ToughnessTestBase):
    test_id: int
    batch_id: str


class ToughnessTestResponse(ToughnessTestBase):
    id: int
    test_id: int
    batch_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class CompositionTestBase(BaseModel):
    cellulose_content: Optional[float] = None
    lignin_content: Optional[float] = None
    hemicellulose_content: Optional[float] = None
    moisture_content: Optional[float] = None
    ash_content: Optional[float] = None
    impurity_content: Optional[float] = None
    ph_value: Optional[float] = None
    organic_matter: Optional[float] = None
    score: Optional[float] = None


class CompositionTestCreate(CompositionTestBase):
    test_id: int
    batch_id: str


class CompositionTestResponse(CompositionTestBase):
    id: int
    test_id: int
    batch_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class QualityTestBase(BaseModel):
    batch_id: str = Field(..., max_length=50)
    tester: Optional[str] = Field(None, max_length=100)
    test_date: Optional[datetime] = None
    test_location: Optional[str] = Field(None, max_length=200)
    remarks: Optional[str] = None


class QualityTestCreate(QualityTestBase):
    test_code: str = Field(..., max_length=50)


class QualityTestCalculate(BaseModel):
    batch_id: str = Field(..., max_length=50)
    color_test: Optional[ColorTestBase] = None
    toughness_test: Optional[ToughnessTestBase] = None
    composition_test: Optional[CompositionTestBase] = None
    custom_parameters: Optional[List[QualityParameterBase]] = None


class QualityGradeResponse(BaseModel):
    batch_id: str
    test_code: str
    overall_score: float
    grade: str
    color_score: Optional[float] = None
    toughness_score: Optional[float] = None
    composition_score: Optional[float] = None
    parameter_scores: Optional[List[dict]] = None
    grade_explanation: str
    recommendations: Optional[List[str]] = None


class QualityTestResponse(QualityTestBase):
    id: int
    test_code: str
    overall_score: Optional[float] = None
    grade: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ThirdPartyReportBase(BaseModel):
    batch_id: str = Field(..., max_length=50)
    test_id: Optional[int] = None
    agency_name: str = Field(..., max_length=200)
    agency_code: Optional[str] = Field(None, max_length=50)
    report_date: Optional[datetime] = None
    report_url: Optional[str] = Field(None, max_length=500)
    report_pdf: Optional[str] = None
    overall_result: Optional[str] = Field(None, max_length=50)
    certified: Optional[bool] = False


class ThirdPartyReportCreate(ThirdPartyReportBase):
    report_id: str = Field(..., max_length=100)


class ThirdPartyReportResponse(ThirdPartyReportBase):
    id: int
    report_id: str
    synced_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
