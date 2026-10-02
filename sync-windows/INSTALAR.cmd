@echo off
cd /d "%~dp0"
py -3 --version >nul 2>&1
if errorlevel 1 (
 echo Instale Python 3.11 o superior desde https://www.python.org/downloads/windows/
 echo Incluya el lanzador Python y vuelva a abrir INSTALAR.cmd.
 pause
 exit /b 1
)
py -3 -m venv .venv
if errorlevel 1 goto error
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto error
echo Instalacion completa. Siga LEEME.md y ejecute VALIDAR.cmd.
pause
exit /b 0
:error
echo No se completo la instalacion. Revise la conexion y los mensajes anteriores.
pause
exit /b 1
