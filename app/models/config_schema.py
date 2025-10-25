from pydantic import BaseModel, Field
from typing import Dict,Any
from bson import ObjectId


class ConfigCreate(BaseModel):
    service_name: str
    env_name: str
    data: Dict[str, str]


class ConfigResponse(ConfigCreate):
    id: str

    @classmethod
    def from_mongo(cls, data: dict):
        data['id'] = str(data.pop('_id'))
        return cls(**data)
