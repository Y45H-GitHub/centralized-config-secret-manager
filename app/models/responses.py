from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None
    timestamp: datetime = datetime.utcnow()

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    error_code: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = datetime.utcnow()

class ConfigCreatedResponse(BaseModel):
    success: bool = True
    message: str = "Configuration created successfully"
    config_id: str
    timestamp: datetime = datetime.utcnow()

class ConfigUpdatedResponse(BaseModel):
    success: bool = True
    message: str = "Configuration updated successfully"
    config_id: str
    changes_made: int
    timestamp: datetime = datetime.utcnow()
