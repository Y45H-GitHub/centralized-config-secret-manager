from app.core.database import db

COLLECTION = db.configs

async def create_config(config_data : dict):
    result = await COLLECTION.insert_one(config_data)
    return str(result.inserted_id)

async def get_config(service_name: str, env:str):
    return await COLLECTION.find_one({'service_name': service_name, 'env': env})

async def get_all_configs():
    configs=  await COLLECTION.find().to_list(1000)
    return [{"id": str(config["_id"]), **{k: v for k, v in config.items() if k != "_id"}} for config in configs]
