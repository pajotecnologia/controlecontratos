@echo off
setlocal
cd /d "%~dp0server"

echo ==========================================
echo ControleComissoes - Backend/API
echo ==========================================

if not exist ".env" (
  echo Criando .env a partir de .env.example...
  copy ".env.example" ".env" >nul
  echo.
  echo ATENCAO: confira DATABASE_URL e JWT_SECRET em server\.env antes de usar em producao.
  echo.
)

echo Instalando dependencias do backend...
call npm install
if errorlevel 1 (
  echo ERRO: npm install falhou no backend.
  pause
  exit /b 1
)

echo Aplicando schema no PostgreSQL...
call npm run init-db
if errorlevel 1 (
  echo.
  echo ERRO: init-db falhou. Verifique se o PostgreSQL esta rodando e se DATABASE_URL em server\.env esta correto.
  pause
  exit /b 1
)

echo Iniciando API em http://localhost:3001 ...
call npm start
pause
