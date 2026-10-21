@echo off
set PATH=%~dp0node;%PATH%
echo Starting Eclipse with local Node.js:
node --version
call npm run dev
