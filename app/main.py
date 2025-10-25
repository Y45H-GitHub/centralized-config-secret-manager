from fastapi import FastAPI
from app.routes import config_routes

app = FastAPI(title='Config Manager')
app.include_router(config_routes.router)