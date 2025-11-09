import os

import aioredis
from dotenv import load_dotenv
from aioredis import Redis

load_dotenv()
redis: Redis | None = None

class RedisService:

    def __init__(self):
        self.REDIS_URL = os.getenv('REDIS_URL')

    async def init_redis(self):
        global redis
        if redis is None:
            redis = aioredis.from_url(self.REDIS_URL, encodings="utf-8", decode_responses=True)

    async def close_redis(self):
        global redis
        if redis:
            await redis.close()
            redis = None

    async def put_token(self,email:str, token:str)->str:
        key = f"register_token:{email}"
        res = await redis.set(key,token,ex=15*60)  #15 minutes
        return res

    async def verify_token(self,token:str, email:str)->bool:
        key = f"register_token:{email}"
        stored_token = await redis.get(key)

        if stored_token is None:
            return False

        return stored_token == token
