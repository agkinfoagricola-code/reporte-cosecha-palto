@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
 echo Ejecute INSTALAR.cmd primero.
 pause
 exit /b 1
)
.venv\Scripts\python.exe sync.py 
pause
