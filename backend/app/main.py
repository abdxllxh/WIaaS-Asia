from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.endpoints import router as analytics_router

# Resolve the static directory relative to this file so the server works
# regardless of the working directory when uvicorn is launched.
_HERE        = Path(__file__).parent          # backend/app/
_STATIC_DIR  = _HERE.parent / "static"        # backend/static/

app = FastAPI(
    title="Weather Intelligence as a Service",
    version="1.0.0",
    description=(
        "WIaaS backend — Climate analytics, physics-degraded resource ledger, "
        "and GNN-to-LLM state vector pipeline."
    ),
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routes ────────────────────────────────────────────────────────────────
app.include_router(analytics_router)

# ── Static Frontend (built by: cd frontend && npm run build) ─────────────────
# The Vite build outputs to backend/static/ automatically.
_STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")


@app.get("/", include_in_schema=False)
def serve_frontend() -> FileResponse:
    """Serve the compiled React/Vite SPA entry point."""
    return FileResponse(str(_STATIC_DIR / "index.html"))
