@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:4173/ once the server starts.
node demo-dist/standalone.js
pause
