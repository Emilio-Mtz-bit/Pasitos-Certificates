@echo off
start "Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
