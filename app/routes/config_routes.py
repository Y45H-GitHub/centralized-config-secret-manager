from fastapi import APIRouter, HTTPException

from app.models.config_schema import ConfigCreate, ConfigResponse, ConfigUpdate
from app.services.config_service import create_config, get_config, get_all_configs, update_config, delete_config, get_config_by_id, get_all_environments, get_all_services

router = APIRouter(prefix="/configs", tags=["configs"])

@router.post("/", response_model=str)
async def create_new_config(config: ConfigCreate):
    config_id = await create_config(config.dict())
    return config_id

@router.get("/", response_model=list[ConfigResponse])
async def list_all_configs():
    return await get_all_configs()

@router.get("/search", response_model=list[ConfigResponse])
async def get_config_by_name_env(service_name: str, env_name: str):
    return await get_config(service_name, env_name)

@router.get("/meta/environments", response_model=list[str])
async def get_environments():
    """Get all unique environment names"""
    return await get_all_environments()

@router.get("/meta/services", response_model=list[str])
async def get_services():
    """Get all unique service names"""
    return await get_all_services()

@router.get("/{config_id}", response_model=ConfigResponse)
async def get_config_by_id_route(config_id: str):
    return await get_config_by_id(config_id)

@router.put("/{config_id}", response_model=str)
async def update_config_data(config_id: str, config: ConfigUpdate):
    result_message = await update_config(config_id, config)
    return result_message

@router.delete("/{config_id}", response_model=str)
async def delete_config_by_id_route(config_id: str):
    result_message = await delete_config(config_id)
    return result_message