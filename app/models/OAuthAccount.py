from datetime import datetime
from typing import Optional

from bson import ObjectId


class OAuthAccount:
    id: ObjectId
    user_id: ObjectId
    provider: str  # 'google', 'github'
    provider_user_id: str
    provider_email: str
    access_token: Optional[str]  # Encrypted
    refresh_token: Optional[str]  # Encrypted
    token_expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime