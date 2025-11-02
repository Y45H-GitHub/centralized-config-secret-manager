from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    email_verified: bool
    is_admin: bool
    auth_providers: list[str]
    created_at: datetime


class OAuthUserCreate(BaseModel):
    email: EmailStr
    name: str
    provider: str
    provider_user_id: str
