import hashlib
import logging
from datetime import datetime
from typing import Any, Coroutine, Optional

from passlib.context import CryptContext

from app.core.database import db
from app.core.exceptions import InvalidCreateUserRequestError, DatabaseConnectionError, UserAlreadyExistsError
from app.models.user import User
from app.models.user_schemas import UserCreate, UserResponse

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self):
        self.user_collection = db.users
        self.oauth_collection = db.oauth_accounts
        # Use argon2 instead of bcrypt to avoid compatibility issues
        self.pwd_context = CryptContext(
            schemes=["argon2", "bcrypt"], 
            deprecated="auto",
            argon2__rounds=4
        )

    # Email hashing utility

    def _hash_email(self, email:str)->str:
        return hashlib.sha256(email.lower().encode("utf8")).hexdigest()

    # Document converter, mongodb document to user model
    def _doc_to_user(self, doc: dict) -> User:
        """Convert MongoDB document to User model"""
        doc["id"] = str(doc.pop("_id"))
        return User(**doc)
    
    # Document converter, mongodb document to UserResponse model
    def _doc_to_user_response(self, doc: dict) -> UserResponse:
        """Convert MongoDB document to UserResponse model (without sensitive fields)"""
        return UserResponse(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc["name"],
            email_verified=doc["email_verified"],
            is_admin=doc["is_admin"],
            auth_providers=doc["auth_providers"],
            created_at=doc["created_at"]
        )

    # Create user

    async def create_user(self, user_data: UserCreate)->str:
        try:
            email_hash = self._hash_email(str(user_data.email))
            exists = await self.user_collection.find_one({"email_hash": email_hash})
            if exists:
                raise UserAlreadyExistsError(str(user_data.email))

            # Ensure password is within bcrypt limits
            safe_password = user_data.password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
            
            user_doc = {
                "email": user_data.email.lower(),
                "email_hash": email_hash,
                "email_verified": False,
                "password_hash": self.pwd_context.hash(safe_password),
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

    # Get user by email (returns UserResponse - no sensitive data)
    async def get_user_by_email(self, email: str) -> UserResponse | None:
        try:
            email_hash = self._hash_email(email)
            user_doc = await self.user_collection.find_one({"email_hash": email_hash})
            if not user_doc:
                return None

            return self._doc_to_user_response(user_doc)
        except Exception as e:
            logger.error(f"Error getting user {email}: {e}")
            return None
    
    # Get user by email (internal method - returns User with sensitive data)
    async def _get_user_by_email_internal(self, email: str) -> User | None:
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
            # Use internal method to get User with password_hash
            user = await self._get_user_by_email_internal(email)

            if not user or not user.password_hash:
                return None

            # Ensure password is within bcrypt limits
            safe_password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
            if not self.pwd_context.verify(safe_password, user.password_hash):
                return None

            return user

        except Exception as e:
            logger.error(f"Error authenticating user: {str(e)}")
            return None

    # Get user by ID (returns UserResponse)
    async def get_user_by_id(self, user_id: str) -> UserResponse | None:
        try:
            from bson import ObjectId
            from bson.errors import InvalidId
            
            # Validate ObjectId
            if not ObjectId.is_valid(user_id):
                return None
                
            user_doc = await self.user_collection.find_one({"_id": ObjectId(user_id)})
            if not user_doc:
                return None

            return self._doc_to_user_response(user_doc)
        except Exception as e:
            logger.error(f"Error getting user by ID {user_id}: {e}")
            return None


    # OAuth User Creation (Simple version for learning)
    async def create_oauth_user(self, email: str, name: str, provider: str, provider_user_id: str) -> str:
        """
        Create a new user from OAuth login (Google, GitHub, etc.)
        
        Key differences from regular user:
        - No password (they login via Google)
        - We store which provider they used
        - We store their provider's user ID
        """
        try:
            # Step 1: Check if user already exists
            email_hash = self._hash_email(email)
            exists = await self.user_collection.find_one({"email_hash": email_hash})
            
            if exists:
                # User already exists, just return their ID
                from bson import ObjectId
                return str(exists["_id"])
            
            # Step 2: Create new user document
            user_doc = {
                "email": email.lower(),
                "email_hash": email_hash,
                "email_verified": True,  # Google already verified their email
                "password_hash": None,  # No password for OAuth users
                "name": name,
                "is_admin": False,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "auth_providers": [provider]  # ["google"] or ["github"]
            }
            
            # Step 3: Insert into database
            result = await self.user_collection.insert_one(user_doc)
            user_id = str(result.inserted_id)
            
            # Step 4: Store OAuth account details in separate collection
            oauth_doc = {
                "user_id": result.inserted_id,
                "provider": provider,  # "google" or "github"
                "provider_user_id": provider_user_id,  # Google's ID for this user
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            await self.oauth_collection.insert_one(oauth_doc)
            
            logger.info(f"Created OAuth user {email} with provider {provider}")
            return user_id
            
        except Exception as e:
            logger.error(f"Error creating OAuth user {email}: {str(e)}")
            raise DatabaseConnectionError()
