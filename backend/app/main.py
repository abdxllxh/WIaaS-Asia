from __future__ import annotations

from fastapi import FastAPI

from app.api.v1.endpoints import router as analytics_router

app = FastAPI(
    title="Weather Intelligence as a Service",
    version="1.0.0",
    description="WIaaS backend exposing climate analytics and physical resource forecasts.",
)

app.include_router(analytics_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "WIaaS backend", "status": "ok"}
