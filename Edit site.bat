@echo off
title Kurtis Barnard - site editor
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

echo.
echo   Starting the editor...
echo   Opening http://localhost:4321 in your browser.
echo.
echo   Keep this window open while you work. Close it when you are done.
echo.

start "" "http://localhost:4321"
node "tools\edit-server.js"

echo.
echo   The editor stopped. If it closed immediately, the message above says why.
echo.
pause
