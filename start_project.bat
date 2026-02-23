@echo off
echo Starting Q-ONE Project...

echo Starting Backend (Port 8001)...
start "Q-ONE Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8001"

echo Starting Frontend (Port 3000)...
start "Q-ONE Frontend" cmd /k "npm run dev"

echo Both services are starting...
echo Backend API will be at: http://127.0.0.1:8001
echo Frontend UI will be at: http://localhost:3000
echo.
echo Please wait for "VITE vX.X.X  ready in X ms" in the Frontend window, then open:
echo http://localhost:3000
pause
