@echo off
cd /d %~dp0

if not exist ".env" (
  echo [!] Chua co file .env
  echo Hay copy file .env.example thanh .env roi dien SERVER_URL vao.
  pause
  exit /b
)

if not exist "node_modules" (
  echo Dang cai dat, chi chay 1 lan dau...
  call npm install
)

node index.js
pause
