from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field
from bson import ObjectId


class ConfigCreate(BaseModel):
    service_name: str
    env_name: str
    data: Dict[str, str]

class ConfigResponse(ConfigCreate):
    id: str
    user_id: Optional[str] = None  # Make optional since we removed auth
    created_at: Optional[datetime] = None  # Make optional for existing records
    updated_at: Optional[datetime] = None  # Make optional for existing records
    version: Optional[int] = None  # Add version field as optional

    @classmethod
    def from_mongo(cls, data: dict):
        data['id'] = str(data.pop('_id'))
        return cls(**data)

class ConfigUpdate(BaseModel):
    service_name: str
    env_name: str
    data: Dict[str, str]