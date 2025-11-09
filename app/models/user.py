from datetime import datetime
from typing import Optional, List

from bson import ObjectId
from pydantic import BaseModel


class User(BaseModel):
    id: Optional[str] = None
    email: str
    email_hash : str
    email_verified : bool = False
    password_hash : Optional[str] = None
    name: str
    is_admin: bool
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    auth_provider: List[str] = []

