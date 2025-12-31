@echo off
echo Starting server in new window...
echo.

REM Kill any process on port 4000 using PowerShell (more reliable)
echo Checking for existing server on port 4000...
powershell -Command "$process = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($process) { Stop-Process -Id $process -Force; Write-Host 'Stopped process on port 4000' } else { Write-Host 'No process found on port 4000' }"
timeout /t 2 /nobreak >nul

echo.
echo Opening server window...
start "LRB Compliance Server" cmd /k "cd /d %~dp0server && echo ======================================== && echo LRB Compliance Server && echo ======================================== && echo. && echo Starting server... && echo Press Ctrl+C to stop && echo. && npm run dev"
echo.
echo Server window opened. You can close this window.
timeout /t 2
