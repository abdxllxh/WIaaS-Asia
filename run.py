"""
WIaaS (Weather Intelligence as a Service) — Quickstart Launcher
Runs the complete production application on http://127.0.0.1:8000
"""
from __future__ import annotations
import os
import sys
import webbrowser
import threading
import time
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"

def check_dependencies() -> None:
    missing = []
    for pkg in ["fastapi", "uvicorn", "pydantic", "requests", "edge_tts"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print("=" * 70)
        print("  WIaaS Quickstart — Missing Python Packages")
        print("=" * 70)
        print("Please install required dependencies before running:\n")
        print("    pip install -r requirements.txt\n")
        print(f"Missing: {', '.join(missing)}")
        print("=" * 70)
        sys.exit(1)

def main() -> None:
    check_dependencies()
    print("=" * 70)
    print("  WIaaS (Weather Intelligence as a Service) — Hackathon Edition")
    print("  Autonomous Climate Resilience & Weather Intelligence Platform")
    print("=" * 70)
    print("  -> Application URL: http://127.0.0.1:8000")
    print("  -> API Docs       : http://127.0.0.1:8000/docs")
    print("  -> Press CTRL+C to stop the server")
    print("=" * 70)

    def open_browser() -> None:
        time.sleep(1.8)
        try:
            webbrowser.open("http://127.0.0.1:8000")
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()

    os.chdir(BACKEND_DIR)
    sys.path.insert(0, str(BACKEND_DIR))

    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()
