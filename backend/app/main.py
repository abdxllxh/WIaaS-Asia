from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.api.v1.endpoints import router as analytics_router

app = FastAPI(
    title="Weather Intelligence as a Service",
    version="1.0.0",
    description="WIaaS backend exposing climate analytics and physical resource forecasts.",
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router)

# Ensure static files directory exists and mount it
os.makedirs("backend/static", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse("backend/static/index.html")

