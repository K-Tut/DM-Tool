@echo off
cd /d "%~dp0"
where python >nul 2>nul && (python dm.py) || (py dm.py)
if errorlevel 1 (
  echo.
  echo Could not start. Is Python installed? See README-DM.md
  pause
)
