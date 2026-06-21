@echo off
cd /d "%~dp0"

echo ============================================
echo   PolicyLens - Employment Policy Interpreter
echo ============================================
echo.

REM Kill any process using port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process on port 3000 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting dev server...
echo Browser will open automatically at http://localhost:3000
echo.

REM Start dev server in background and open browser
start /b cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:3000"

npm run dev
echo.
pause
