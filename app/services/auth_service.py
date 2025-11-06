from datetime import datetime, timedelta
from fastapi import HTTPException
from jose import jwt, JWTError
from passlib.context import CryptContext

class AuthService:
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"])
        self.secret_key = "secret-key-to-be-added-later"
        self.algorithm = "HS256"

    def create_access_token(self, user_id:str)->str:
        expire = datetime.now() + timedelta(hours=24)
        payload = {"sub" : user_id, "exp" : expire}
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token:str)->str:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise JWTError("INVALID TOKEN")
            return user_id
        except JWTError:
            raise HTTPException(status_code=401, detail="INVALID TOKEN")

