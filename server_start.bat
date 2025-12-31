@echo off
echo ========================================
echo Starting LRB Compliance Server...
echo ========================================
echo.

REM Check if port 4000 is in use and kill the process
echo Checking for existing server on port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    echo Found process using port 4000 (PID: %%a), stopping it...
    taskkill /PID %%a /F
    timeout /t 2 /nobreak >nul
)
echo Port check complete.

echo.
echo Changing to server directory...
cd /d "%~dp0server"
if errorlevel 1 (
    echo ERROR: Could not change to server directory!
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ERROR: package.json not found in server directory!
    echo Current directory: %CD%
    echo Make sure this batch file is in the project root.
    pause
    exit /b 1
)

echo Current directory: %CD%
echo.
echo Checking if node_modules exists...
if not exist "node_modules" (
    echo WARNING: node_modules not found. Run 'npm install' first!
    echo.
    pause
)

echo.
echo ========================================
echo Starting server with: npm run dev
echo ========================================
echo.
echo The server will run in this window.
echo Press Ctrl+C to stop the server when done.
echo.
echo ========================================
echo.

REM Run npm - keep window open
npm run dev

REM If we get here, server stopped
echo.
echo ========================================
echo Server has stopped.
echo.
pause
