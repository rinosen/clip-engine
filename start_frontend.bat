@echo off
echo ========================================================
echo   AutoClipper AI - Starting Next.js Web Dashboard
echo ========================================================

cd /d "%~dp0frontend"
call npm.cmd run dev
pause
