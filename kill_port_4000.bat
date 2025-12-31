@echo off
echo Killing any process on port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo Stopping process PID: %%a
    taskkill /PID %%a /F
)
timeout /t 2 /nobreak >nul
echo Done.

