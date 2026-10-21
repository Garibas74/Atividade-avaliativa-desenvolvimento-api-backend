@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 (
  pause
) else (
  start "" "http://localhost:3001"
)
