from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    display_name: str
    critical_level: int = 3
    category: str = "Genel"


class ProductOut(BaseModel):
    id: int
    name: str
    display_name: str
    critical_level: int
    category: str
    active: bool

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    display_name: Optional[str] = None
    critical_level: Optional[int] = None
    category: Optional[str] = None
    active: Optional[bool] = None


class DetectedItem(BaseModel):
    name: str
    display_name: str
    count: int
    critical_level: int
    status: str  # "OK" | "EKSIK" | "KRITIK"
    percentage: float


class AnalysisResult(BaseModel):
    id: int
    detected: Dict[str, int]
    items: List[DetectedItem]
    missing: List[str]
    ai_report: str
    total_items: int
    missing_count: int
    annotated_image: Optional[str] = None  # base64
    analyzed_at: str


class AnalysisRecordOut(BaseModel):
    id: int
    image_filename: str
    total_items: int
    missing_count: int
    ai_report: str
    source: str
    analyzed_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_analyses: int
    total_items_detected: int
    total_missing: int
    avg_missing_per_analysis: float
    most_missing_product: Optional[str]
    recent_analyses: List[AnalysisRecordOut]


class CameraStatus(BaseModel):
    active: bool
    source: str
    fps: float
