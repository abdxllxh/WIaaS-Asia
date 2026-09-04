@echo off
title WIaaS - Weather Intelligence as a Service
echo ======================================================================
echo   Starting WIaaS (Weather Intelligence as a Service)
echo ======================================================================
echo Checking dependencies...
python -m pip install -q -r requirements.txt
echo Launching application...
python run.py
pause
