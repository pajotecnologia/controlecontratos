@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo ControleComissoes - Frontend (Vite)
echo ==========================================

if not exist ".env" (
  echo Criando .env apontando para o backend local...
  >.env echo VITE_API_URL="http://localhost:3001"
)

echo Instalando dependencias do frontend...
call npm install
if errorlevel 1 (
  echo ERRO: npm install falhou no frontend.
  pause
  exit /b 1
)

echo Iniciando servidor de desenvolvimento...
call npm run dev
pause
