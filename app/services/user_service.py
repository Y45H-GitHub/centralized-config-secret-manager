import hashlib
import logging
from datetime import datetime
from typing import Any, Coroutine, Optional

from passlib.context import CryptContext

from app.core.database import db
from app.core.exceptions import InvalidCreateUserRequestError, DatabaseConnectionError, UserAlreadyExistsError
from app.models.user import User
from app.models.user_schemas import UserCreate

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self):
        self.user_collection = db.users
        self.oauth_collection = db.oauth_accounts
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # Email hashing utility

    def _hash_email(self, email:str)->str:
        return hashlib.sha256(email.lower().encode("utf8")).hexdigest()

    # Document converter, mongodb document to user model
    def _doc_to_user(self, doc: dict) -> User:
        """Convert MongoDB document to User model"""
        doc["id"] = str(doc.pop("_id"))
        return User(**doc)

    # Create user

    async def create_user(self, user_data: UserCreate)->str:
        try:
            email_hash = self._hash_email(user_data.email)
            exists = await self.user_collection.find_one({"email_hash": email_hash})
            if exists:
                raise UserAlreadyExistsError(user_data.email)

            user_doc = {
                "email": user_data.email.lower(),
                "email_hash": email_hash,
                "email_verified": False,
                "password_hash": self.pwd_context.hash(user_data.password),
                "name": user_data.name,
                "is_admin": False,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "auth_providers": ["email"]
            }

            result = await self.user_collection.insert_one(user_doc)
            logger.info(f"Created user {user_data.email} with id {result.inserted_id}")
            return str(result.inserted_id)

        except UserAlreadyExistsError:
            raise
        except Exception as e:
            logger.error(f"Error creating user {user_data.email}: {e}")
            raise DatabaseConnectionError()

    # Get user by email

    async def get_user_by_email(self, email:str)-> User | None:
        try:
            email_hash = self._hash_email(email)
            user_doc = await self.user_collection.find_one({"email_hash": email_hash})
            if not user_doc:
                return None

            return self._doc_to_user(user_doc)
        except Exception as e:
            logger.error(f"Error getting user {email}: {e}")
            return None

    # authenticate user

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email/password"""
        try:
            user = await self.get_user_by_email(email)

            if not user or not user.password_hash:
                return None

            if not self.pwd_context.verify(password, user.password_hash):
                return None

            return user

        except Exception as e:
            logger.error(f"Error authenticating user: {str(e)}")
            return None
