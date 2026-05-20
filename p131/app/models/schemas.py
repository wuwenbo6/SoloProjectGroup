from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SequenceBase(BaseModel):
    seq_id: str = Field(..., description="Unique sequence identifier")
    header: str = Field(..., description="FASTA header")
    sequence: str = Field(..., description="Gene sequence")
    seq_type: str = Field(default="DNA", description="Sequence type: DNA or PROTEIN")
    description: Optional[str] = None
    organism: Optional[str] = None


class SequenceCreate(SequenceBase):
    pass


class SequenceResponse(SequenceBase):
    id: str
    length: int
    gc_content: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlignmentResult(BaseModel):
    seq_id: str
    query_start: int
    query_end: int
    subject_start: int
    subject_end: int
    score: float
    bit_score: float
    identity: float
    evalue: float
    aligned_query: str
    aligned_subject: str


class AlignmentRequest(BaseModel):
    sequence: str
    seq_type: str = "DNA"
    evalue_threshold: float = 10.0


class AlignmentJobResponse(BaseModel):
    job_id: str
    status: str
    query_length: Optional[int] = None
    results: Optional[List[AlignmentResult]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class DatabaseStats(BaseModel):
    num_sequences: int
    total_length: int
    avg_length: float
    seq_type_distribution: dict


class TaskStatus(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
