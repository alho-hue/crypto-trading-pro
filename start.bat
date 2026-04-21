@echo off
echo ===================================
echo    NEUROVEST - Starting Services
echo ===================================
echo.

REM Check if MongoDB is running
netstat -an | findstr "27017" >nul
if errorlevel 1 (
    echo [WARNING] MongoDB not detected on port 27017
    echo Please start MongoDB first:
    echo   - Docker: docker run -d -p 27017:27017 --name neurovest-mongo mongo:6
    echo   - Local:  mongod --dbpath C:\data\db
    echo.
    pause
    exit /b 1
)

echo [OK] MongoDB detected
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

REM Start Backend
echo Starting Backend Server...
start "NEUROVEST Backend" cmd /k "cd backend && npm start"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo Starting Frontend Dev Server...
start "NEUROVEST Frontend" cmd /k "npm run dev"

echo.
echo ===================================
echo    Services Started Successfully!
echo ===================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo.
echo Press any key to stop all services...
pause >nul

REM Kill processes
taskkill /FI "WindowTitle eq NEUROVEST Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq NEUROVEST Frontend*" /F >nul 2>&1

echo.
echo Services stopped.
