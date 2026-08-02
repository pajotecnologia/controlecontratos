@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Recompilar frontend e atualizar server/public
echo ==========================================

echo Instalando dependencias (se necessario)...
call npm install
if errorlevel 1 (
  echo ERRO: npm install falhou.
  pause
  exit /b 1
)

echo Compilando frontend...
call npm run build
if errorlevel 1 (
  echo ERRO: npm run build falhou.
  pause
  exit /b 1
)

echo Atualizando server/public com a nova build...
if exist "server\public" (
  rmdir /s /q "server\public"
)
xcopy /e /i /q "dist" "server\public"
if errorlevel 1 (
  echo ERRO: falha ao copiar dist para server/public.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo Frontend recompilado com sucesso!
echo Reinicie o backend (iniciar-backend.bat) e
echo acesse http://localhost:3001
echo ==========================================
pause
