@echo off
rem Lets phones on your Wi-Fi or on the laptop's hotspot reach the DM Tool (port 8766).
rem Double-click it once and answer "Yes" when Windows asks for permission.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="DM Tool (phones)" >nul 2>&1
netsh advfirewall firewall add rule name="DM Tool (phones)" dir=in action=allow protocol=TCP localport=8766 profile=any
echo.
echo Done. Phones can now reach the DM Tool on port 8766 (also on the laptop's hotspot).
echo You can close this window.
pause
