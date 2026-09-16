@echo off
title Kurtis Barnard - drone clips
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this PC.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "drone-source" mkdir "drone-source"

echo.
echo   Encoding anything in drone-source\ ...
echo.

node "tools\make-drone-clips.js" %*

echo.
echo   Done. Open the editor and use Save ^& publish to put these live.
echo.
pause
