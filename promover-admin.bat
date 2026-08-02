@echo off
setlocal EnableDelayedExpansion
rem ====================================================================
rem Promover um usuario a administrador no ControleComissoes (PostgreSQL)
rem Uso: clicar duas vezes ou rodar no cmd. Para mudar o email alvo,
rem edite a variavel EMAIL abaixo.
rem ====================================================================

set "EMAIL=pajotecnologia@gmail.com"
set "DBNAME=controle_comissoes"
set "PGHOST=localhost"
set "PGUSER=postgres"

rem Descobre psql.exe (PostgreSQL 16 -> 15 -> 14 -> PATH)
set "PSQL="
for %%V in (16 15 14 13) do (
  if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\%%V\bin\psql.exe"
)
if not defined PSQL (
  for %%P in (psql.exe) do if not defined PSQL set "PSQL=%%~$PATH:P"
)
if not defined PSQL (
  echo ERRO: psql.exe nao encontrado. Instale o PostgreSQL ou adicione a pasta bin ao PATH.
  pause
  exit /b 1
)

echo ==========================================
echo Promover usuario a ADMINISTRADOR
echo ==========================================
echo Servidor : %PGHOST%
echo Banco    : %DBNAME%
echo Usuario PG: %PGUSER%
echo Email a promover: %EMAIL%
echo.

set "PGPASSWORD="
set /p "PGPASSWORD=Digite a senha do usuario postgres do PostgreSQL: "
if not defined PGPASSWORD (
  echo Senha em branco. Abortando.
  pause
  exit /b 1
)

echo.
echo --- Situacao ATUAL do usuario ---
"%PSQL%" -h %PGHOST% -U %PGUSER% -d %DBNAME% -c "SELECT u.email, COALESCE(r.role::text,'(nenhuma)') AS role FROM users u LEFT JOIN user_roles r ON r.user_id = u.id WHERE u.email = '%EMAIL%';"
if errorlevel 1 (
  echo.
  echo ERRO ao consultar o banco. Causas comuns:
  echo   - senha do postgres errada
  echo   - PostgreSQL nao esta rodando
  echo   - banco 'controle_comissoes' nao existe
  echo   - o usuario %EMAIL% ainda nao se cadastrou pela tela /auth
  pause
  exit /b 1
)

echo.
echo --- Promovendo para admin ---
"%PSQL%" -h %PGHOST% -U %PGUSER% -d %DBNAME% -c "INSERT INTO user_roles (user_id, role) SELECT u.id, 'admin' FROM users u WHERE u.email = '%EMAIL%' ON CONFLICT (user_id, role) DO NOTHING;"
if errorlevel 1 (
  echo ERRO ao promover. Veja acima.
  pause
  exit /b 1
)

echo.
echo --- Situacao FINAL do usuario ---
"%PSQL%" -h %PGHOST% -U %PGUSER% -d %DBNAME% -c "SELECT u.email, r.role FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.email = '%EMAIL%';"
if errorlevel 1 (
  echo.
  echo Aviso: nao foi possivel confirmar a role. Verifique manualmente.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo Se acima aparecer: %EMAIL% | admin  -> pronto.
echo Faca logoff/login no sistema para a UI refletir o novo papel.
echo ==========================================
set "PGPASSWORD="
pause
