from fastapi import HTTPException
from typing import Any,Dict,List,Optional

class ConfigManagerException(HTTPException):
    def __init__(self, status_code: int, detail: str, headers: Optional[Dict[str, Any]] = None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)

class ConfigNotFoundError(ConfigManagerException):
    def __init__(self, config_id: str = None, service_name: str = None, env_name: str = None):
        if config_id:
            detail = f"Configuration with ID '{config_id}' not found"
        else:
            detail = f"No configurations found for service '{service_name}' in environment '{env_name}'"
        super().__init__(status_code=404, detail=detail)

class ConfigAlreadyExists(ConfigManagerException):
    def __init__(self, service_name: str, env_name: str):
        detail = f"Configuration with name '{service_name}' already exists in environment '{env_name}'"
        super().__init__(status_code=409, detail=detail)

class InvalidConfigDataError(ConfigManagerException):
    def __init__(self, message: str):
        super().__init__(status_code=422, detail=f"Invalid configuration data: {message}")

class DatabaseConnectionError(ConfigManagerException):
    def __init__(self):
        super().__init__(status_code=503, detail="Database connection failed. Please try again later.")
