@echo off
start "Backend - ControleComissoes" cmd /k "%~dp0iniciar-backend.bat"
timeout /t 5 /nobreak >nul
start "Frontend - ControleComissoes" cmd /k "%~dp0iniciar-frontend.bat"
