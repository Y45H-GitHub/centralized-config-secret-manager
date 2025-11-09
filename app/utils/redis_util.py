import secrets
import hashlib
from datetime import datetime
from typing import Tuple


def hash_token(token:str)-> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RedisUtil():
    def __init__(self):
        self.TOKEN_BYTES =32
        self.TOKEN_TTL = 15*60

    def generate_token(self,email:str)->str:
        return secrets.token_urlsafe(self.TOKEN_BYTES)

    def generate_hashed_token(self, email:str)->str:
        return hash_token(self.generate_token(email))
