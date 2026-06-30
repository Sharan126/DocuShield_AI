from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str = "Underwriter"
    name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    otp_verified: bool
    created_by: Optional[int] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserAdminCreate(BaseModel):
    username: str
    name: Optional[str] = None
    email: EmailStr
    password: str
    role: str = "Underwriter"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserPasswordResetAdmin(BaseModel):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class OTPVerify(BaseModel):
    username: str
    otp_code: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    otp_required: bool

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class DocumentResponse(BaseModel):
    id: int
    file_name: str
    file_type: str
    fraud_score: float
    confidence_score: float
    risk_level: str
    metadata_status: str
    font_status: str
    signature_status: str
    compression_status: str
    uploaded_at: datetime
    uploaded_by_id: int
    gnn_fraud_probability: Optional[float] = 0.0
    gnn_risk_level: Optional[str] = "Low"

    @field_validator("uploaded_at", mode="before")
    @classmethod
    def ensure_utc_timezone(cls, v):
        """Ensure uploaded_at carries UTC timezone info for correct frontend rendering."""
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class LayoutLMv3Field(BaseModel):
    value: str
    confidence: float

class LayoutLMv3IncomeField(BaseModel):
    value: float
    confidence: float

class LayoutLMv3Intelligence(BaseModel):
    applicant_name: LayoutLMv3Field
    address: LayoutLMv3Field
    income: LayoutLMv3IncomeField
    property_id: LayoutLMv3Field
    document_type: LayoutLMv3Field

class DocumentAnalysisResponse(BaseModel):
    id: Optional[int] = None
    document_id: str
    status: str
    ocr_text: str
    metadata: dict
    risk_score: float
    risk_level: str
    issues: List[str]
    layoutlm_intelligence: Optional[LayoutLMv3Intelligence] = None
    signature_similarity: Optional[float] = 1.0
    possible_forgery: Optional[bool] = False
    gnn_fraud_probability: Optional[float] = 0.0
    gnn_risk_level: Optional[str] = "Low"

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    username: str
    event: str
    status: str

    class Config:
        from_attributes = True

class CrossValidationResponse(BaseModel):
    id: int
    primary_document_id: int
    secondary_document_id: int
    name_match: bool
    address_match: bool
    property_match: bool
    financial_match: bool
    discrepancy_report: Optional[str] = None
    checked_at: datetime

    class Config:
        from_attributes = True

class PasswordReset(BaseModel):
    username: str
    new_password: str
