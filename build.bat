@echo off
cd /d "%~dp0"
echo Building project...
call npm run build
echo.
echo Starting preview server...
call npx vite preview --port 4173
pause
