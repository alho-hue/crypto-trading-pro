@echo off
cd /d "c:\Users\DIALLO\OneDrive\Bureau\crypto-trading-pro\backend"
echo Installing dependencies...
call npm install
echo.
echo Starting server...
node server.js
pause
