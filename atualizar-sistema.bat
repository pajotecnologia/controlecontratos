@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Atualizar Sistema - Build + Deploy Local
echo ==========================================

echo [1/3] Compilando frontend com configuracao de producao...
call npm run build
if errorlevel 1 (
  echo ERRO: npm run build falhou.
  pause
  exit /b 1
)

echo [2/3] Copiando build para a raiz, public e server/public...
xcopy /e /i /q /y "dist" "."
xcopy /e /i /q /y "dist" "public"
xcopy /e /i /q /y "dist" "server\public"

echo [3/3] Aplicando migracoes no banco de dados...
cd server
call npm run migrate
if errorlevel 1 (
  echo AVISO: migrate falhou. Verifique se o banco esta rodando.
)
cd ..

echo.
echo ==========================================
echo Sistema atualizado!
echo Reinicie o backend se ja estiver rodando.
echo ==========================================
pause
