from fastapi import APIRouter, HTTPException
from app.models.config_schema import ConfigCreate, ConfigResponse
from app.services.config_service import create_config,get_config,get_all_configs

router = APIRouter(prefix="/configs", tags=["configs"])

@router.post("/", response_model=str)
async def create_new_config(config: ConfigCreate):
    config_id = await create_config(config.dict())
    return config_id

@router.get("/", response_model=list[ConfigResponse])
async def list_all_configs():
    return await get_all_configs()