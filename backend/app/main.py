from __future__ import annotations

import os
import sys
from pathlib import Path

# Force stdout/stderr to UTF-8 on Windows to prevent UnicodeEncodeError
# when printing state vectors or pipeline logs containing non-ASCII characters.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests

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

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/assets") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.get("/health", tags=["system"])
def health_check() -> dict:
    """Standard health check endpoint for monitoring, Docker, and evaluators."""
    from datetime import datetime, timezone
    return {
        "status": "healthy",
        "service": "WIAAS Asia",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ── API Routes ────────────────────────────────────────────────────────────────
app.include_router(analytics_router)

class TTSRequest(BaseModel):
    text: str
    lang: str = "en"

@app.post("/api/v1/tts")
async def generate_voice_advisory(req: TTSRequest):
    try:
        import edge_tts
        text = req.text.strip()
        if not text:
            return Response(content=b"", status_code=400)
        # Natural neural voices shared by global advisories and chat replies.
        voice = "ur-PK-UzmaNeural" if req.lang.lower().startswith("ur") else "en-US-JennyNeural"
        rate = "-4%" if req.lang.lower().startswith("ur") else "-2%"
        pitch = "+0Hz"
        communicate = edge_tts.Communicate(text[:7000], voice, rate=rate, pitch=pitch)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        audio_data = b"".join(audio_chunks)
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        print(f"[TTS Error] {e}")
        return Response(content=b"", status_code=500)

@app.get("/api/v1/client-location")
async def get_client_location(request: Request):
    """Detects country, city, and timezone of the client for localhost timeline."""
    client_ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or getattr(request.client, "host", "")
    query_ip = "" if client_ip in ("127.0.0.1", "localhost", "::1", "0.0.0.0", "testclient") else client_ip

    # Primary: ipwho.is (fast, HTTPS, CORS, detailed timezone)
    try:
        url = f"https://ipwho.is/{query_ip}".rstrip("/")
        resp = requests.get(url, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success", False):
                tz = data.get("timezone") or {}
                return {
                    "status": "success",
                    "source": "ipwho.is",
                    "city": data.get("city") or "Karachi",
                    "region": data.get("region") or "Sindh",
                    "country": data.get("country") or "Pakistan",
                    "country_code": data.get("country_code") or "PK",
                    "latitude": data.get("latitude", 24.86),
                    "longitude": data.get("longitude", 67.01),
                    "timezone": tz.get("id") or "Asia/Karachi",
                    "timezone_code": tz.get("abbr") or "PKT",
                    "timezone_offset": (tz.get("offset", 18000) / 3600.0) if tz.get("offset") is not None else 5.0,
                }
    except Exception:
        pass

    # Secondary fallback: ip-api.com
    try:
        url = f"http://ip-api.com/json/{query_ip}".rstrip("/")
        resp = requests.get(url, timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                return {
                    "status": "success",
                    "source": "ip-api.com",
                    "city": data.get("city") or "Islamabad",
                    "region": data.get("regionName") or "Islamabad",
                    "country": data.get("country") or "Pakistan",
                    "country_code": data.get("countryCode") or "PK",
                    "latitude": data.get("lat", 33.72),
                    "longitude": data.get("lon", 73.04),
                    "timezone": data.get("timezone") or "Asia/Karachi",
                    "timezone_code": "PKT",
                    "timezone_offset": 5.0,
                }
    except Exception:
        pass

    # Built-in robust default
    return {
        "status": "fallback",
        "source": "default",
        "city": "Karachi",
        "country": "Pakistan",
        "country_code": "PK",
        "timezone": "Asia/Karachi",
        "timezone_code": "PKT",
        "timezone_offset": 5.0,
    }

_STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

@app.get("/", include_in_schema=False)
def serve_frontend() -> FileResponse:
    """Serve the compiled Vite SPA entry point with no-cache headers."""
    response = FileResponse(str(_STATIC_DIR / "index.html"))
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/wiaas-logo.svg", include_in_schema=False)
def serve_wiaas_logo() -> FileResponse:
    """Serve the lightweight brand mark used by the browser tab and loader."""
    return FileResponse(str(_STATIC_DIR / "wiaas-logo.svg"), media_type="image/svg+xml")
