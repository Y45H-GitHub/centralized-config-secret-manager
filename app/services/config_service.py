from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import ConnectionFailure
from datetime import datetime
from typing import List, Dict, Any
import re

from app.core.database import db
from app.core.exceptions import ConfigAlreadyExists, DatabaseConnectionError, ConfigManagerException, \
    ConfigNotFoundError, InvalidConfigDataError
from app.models.config_schema import ConfigUpdate
import logging

logger = logging.getLogger(__name__)

# Configuration constants
COLLECTION = db.configs
MAX_CONFIGS_LIMIT = 1000
MAX_SERVICE_NAME_LENGTH = 100
MAX_ENV_NAME_LENGTH = 50
MAX_CONFIG_KEYS = 100

async def create_config(config_data: dict, user_id: str) -> str:
    """Create a new configuration and return its ID"""
    try:
        config_data["user_id"] = ObjectId(user_id)
        # Validate input data
        _validate_config_data(config_data)
        
        # Check for duplicates
        exists = await COLLECTION.find_one({
            "user_id": ObjectId("user_id"),
            "service_name": config_data["service_name"],
            "env_name": config_data["env_name"]
        })

        if exists:
            raise ConfigAlreadyExists(config_data["service_name"], config_data["env_name"])

        # Add metadata
        config_with_metadata = _add_metadata(config_data.copy())
        
        result = await COLLECTION.insert_one(config_with_metadata)
        
        logger.info(
            f"Created config for {config_data['service_name']}/{config_data['env_name']}",
            extra={"config_id": str(result.inserted_id), "operation": "create_config"}
        )
        
        return str(result.inserted_id)
        
    except (ConfigAlreadyExists, InvalidConfigDataError):
        raise
    except ConnectionFailure:
        logger.error("Connection failure during config creation")
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error while creating config: {str(e)}")
        raise ConfigManagerException(500, "Internal Server Error")

async def get_config(service_name: str, env_name: str) -> List[Dict[str, Any]]:
    """Get configurations by service name and environment"""
    try:
        # Validate input parameters
        _validate_service_env_params(service_name, env_name)
        
        results = await COLLECTION.find({
            'service_name': service_name, 
            'env_name': env_name
        }).to_list(MAX_CONFIGS_LIMIT)
        
        if not results:
            raise ConfigNotFoundError(service_name=service_name, env_name=env_name)

        return _format_config_documents(results)
        
    except (ConfigNotFoundError, InvalidConfigDataError):
        raise
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error getting configs for {service_name}/{env_name}: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def get_all_configs() -> List[Dict[str, Any]]:
    """Get all configurations"""
    try:
        configs = await COLLECTION.find().to_list(MAX_CONFIGS_LIMIT)
        return _format_config_documents(configs)
        
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error getting all configs: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def update_config(config_id: str, config_data: ConfigUpdate) -> Dict[str, Any]:
    """Update configuration and return update info"""
    try:
        # Validate config ID
        obj_id = _validate_object_id(config_id)
        
        # Validate config data
        _validate_config_data(config_data.dict())
        
        # Add update metadata
        update_data = _add_metadata(config_data.dict(), is_update=True)
        
        result = await COLLECTION.update_one(
            {'_id': obj_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise ConfigNotFoundError(config_id=config_id)
        
        logger.info(
            f"Updated config {config_id}",
            extra={"config_id": config_id, "modified_count": result.modified_count, "operation": "update_config"}
        )
        
        return {
            "config_id": config_id,
            "modified_count": result.modified_count,
            "message": "Config updated successfully"
        }
        
    except (ConfigNotFoundError, InvalidConfigDataError):
        raise
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error updating config {config_id}: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def delete_config(config_id: str) -> Dict[str, Any]:
    """Delete configuration and return deletion info"""
    try:
        # Validate config ID
        obj_id = _validate_object_id(config_id)
        
        result = await COLLECTION.delete_one({'_id': obj_id})
        
        if result.deleted_count == 0:
            raise ConfigNotFoundError(config_id=config_id)
        
        logger.info(
            f"Deleted config {config_id}",
            extra={"config_id": config_id, "deleted_count": result.deleted_count, "operation": "delete_config"}
        )
        
        return {
            "config_id": config_id,
            "deleted_count": result.deleted_count,
            "message": "Config deleted successfully"
        }
        
    except (ConfigNotFoundError, InvalidConfigDataError):
        raise
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error deleting config {config_id}: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def get_config_by_id(config_id: str) -> Dict[str, Any]:
    """Get configuration by ID"""
    try:
        # Validate config ID
        obj_id = _validate_object_id(config_id)
        
        result = await COLLECTION.find_one({'_id': obj_id})
        
        if result is None:
            raise ConfigNotFoundError(config_id=config_id)
        
        return _format_config_document(result)
        
    except (ConfigNotFoundError, InvalidConfigDataError):
        raise
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error getting config {config_id}: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def get_all_environments() -> List[str]:
    """Get all unique environment names from existing configurations"""
    try:
        # Get distinct environment names from the database
        environments = await COLLECTION.distinct("env_name")
        
        # Sort alphabetically for consistent ordering
        environments.sort()
        
        logger.info(f"Retrieved {len(environments)} unique environments")
        return environments
        
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error getting environments: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def get_all_services() -> List[str]:
    """Get all unique service names from existing configurations"""
    try:
        # Get distinct service names from the database
        services = await COLLECTION.distinct("service_name")
        
        # Sort alphabetically for consistent ordering
        services.sort()
        
        logger.info(f"Retrieved {len(services)} unique services")
        return services
        
    except ConnectionFailure:
        raise DatabaseConnectionError()
    except Exception as e:
        logger.error(f"Unexpected error getting services: {str(e)}")
        raise ConfigManagerException(500, "Internal server error")

async def get_user_configs(user_id: str) -> List[Dict[str, Any]]:
    """Get all configs for a specific user"""
    configs = await COLLECTION.find({
        "user_id": ObjectId(user_id)
    }).to_list(MAX_CONFIGS_LIMIT)
    return _format_config_documents(configs)


# HELPER FUNCTIONS


def _format_config_document(doc: dict) -> dict:
    """Convert single MongoDB document to API response format"""
    return {"id": str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"}}

def _format_config_documents(docs: List[dict]) -> List[dict]:
    """Convert list of MongoDB documents to API response format"""
    return [_format_config_document(doc) for doc in docs]

def _validate_object_id(config_id: str) -> ObjectId:
    """Validate and convert string ID to ObjectId"""
    if not ObjectId.is_valid(config_id):
        raise InvalidConfigDataError("Invalid configuration ID format")
    return ObjectId(config_id)

def _validate_config_data(data: dict) -> None:
    """Validate configuration data"""
    # Check required fields
    if not data.get("service_name", "").strip():
        raise InvalidConfigDataError("Service name is required")
    
    if not data.get("env_name", "").strip():
        raise InvalidConfigDataError("Environment name is required")
    
    if not isinstance(data.get("data"), dict) or not data["data"]:
        raise InvalidConfigDataError("Configuration data must be a non-empty dictionary")
    
    # Validate field lengths
    if len(data["service_name"]) > MAX_SERVICE_NAME_LENGTH:
        raise InvalidConfigDataError(f"Service name too long (max {MAX_SERVICE_NAME_LENGTH} characters)")
    
    if len(data["env_name"]) > MAX_ENV_NAME_LENGTH:
        raise InvalidConfigDataError(f"Environment name too long (max {MAX_ENV_NAME_LENGTH} characters)")
    
    # Validate service_name format (alphanumeric, hyphens, underscores only)
    if not re.match(r'^[a-zA-Z0-9-_]+$', data["service_name"]):
        raise InvalidConfigDataError("Service name can only contain letters, numbers, hyphens, and underscores")
    
    # Validate env_name format
    if not re.match(r'^[a-zA-Z0-9-_]+$', data["env_name"]):
        raise InvalidConfigDataError("Environment name can only contain letters, numbers, hyphens, and underscores")
    
    # Validate config data
    if len(data["data"]) > MAX_CONFIG_KEYS:
        raise InvalidConfigDataError(f"Too many configuration keys (max {MAX_CONFIG_KEYS})")
    
    # Validate each key-value pair
    for key, value in data["data"].items():
        if not key.strip():
            raise InvalidConfigDataError("Configuration keys cannot be empty")
        
        if len(key) > 100:
            raise InvalidConfigDataError(f"Configuration key '{key}' too long (max 100 characters)")
        
        if not isinstance(value, str):
            raise InvalidConfigDataError(f"Configuration value for '{key}' must be a string")
        
        if len(value) > 10000:
            raise InvalidConfigDataError(f"Configuration value for '{key}' too long (max 10000 characters)")

def _validate_service_env_params(service_name: str, env_name: str) -> None:
    """Validate service name and environment name parameters"""
    if not service_name or not service_name.strip():
        raise InvalidConfigDataError("Service name parameter is required")
    
    if not env_name or not env_name.strip():
        raise InvalidConfigDataError("Environment name parameter is required")

def _add_metadata(data: dict, is_update: bool = False) -> dict:
    """Add timestamps and metadata to config data"""
    now = datetime.now()
    
    if not is_update:
        data["created_at"] = now
        data["version"] = 1
    else:
        # For updates, increment version if it exists
        if "version" in data:
            data["version"] += 1
        else:
            data["version"] = 1
    
    data["updated_at"] = now
    return data

