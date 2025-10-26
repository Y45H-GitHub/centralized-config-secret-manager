from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from app.core.database import db
from app.models.config_schema import ConfigUpdate

COLLECTION = db.configs

async def create_config(config_data : dict):
    result = await COLLECTION.insert_one(config_data)
    return str(result.inserted_id)


async def get_config(service_name: str, env_name: str):
    results = await COLLECTION.find({'service_name': service_name, 'env_name': env_name}).to_list(1000)
    if not results:
        raise HTTPException(status_code=404, detail="No configs found for this service and environment")

    return [{"id": str(config["_id"]), **{k: v for k, v in config.items() if k != "_id"}} for config in results]


async def get_all_configs():
    configs=  await COLLECTION.find().to_list(1000)
    return [{"id": str(config["_id"]), **{k: v for k, v in config.items() if k != "_id"}} for config in configs]

async def update_config(config_id, config_data: ConfigUpdate):
    try:
        result = await COLLECTION.update_one(
            {'_id': ObjectId(config_id)},
            {'$set': config_data.dict()}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Config not found")

        return "Config updated successfully"

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid config ID format")

async def delete_config(config_id):
    try:
        result = await COLLECTION.delete_one({'_id': ObjectId(config_id)})
        if result.deleted_count == 0 :
            raise HTTPException(status_code=404, detail="Config not found")
        return "Config deleted successfully"
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid config ID format")

async def get_config_by_id(config_id: str):
    try:
        result = await COLLECTION.find_one({'_id': ObjectId(config_id)})
        if result is None:
            raise HTTPException(status_code=404, detail="Config not found")
        
        # Return the document with proper formatting
        return {"id": str(result["_id"]), **{k: v for k, v in result.items() if k != "_id"}}
        
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid config ID format")

