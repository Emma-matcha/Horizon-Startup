@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1"
if errorlevel 1 (
  echo.
  echo Red House could not start. Review the message above.
  pause
)

endlocal
