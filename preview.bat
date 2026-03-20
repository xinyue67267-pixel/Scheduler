@echo off
title Scheduler Preview Server
cd /d "%~dp0"
echo Starting Scheduler preview server...
echo.
echo Server will open at: http://127.0.0.1:9999
echo Press Ctrl+C to stop the server
echo.
node node_modules/vite/bin/vite.js preview --port 9999 --host 127.0.0.1
pause
