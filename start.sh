#!/usr/bin/env bash
echo "======================================================================"
echo "  Starting WIaaS (Weather Intelligence as a Service)"
echo "======================================================================"
python3 -m pip install -q -r requirements.txt
python3 run.py
