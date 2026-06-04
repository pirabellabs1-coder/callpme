@echo off
REM Lanceur Windows — serveur de clonage vocal local Callpme
cd /d "%~dp0"

if not exist ".venv" (
  echo [Callpme] Creation de l'environnement Python...
  py -3.11 -m venv .venv || python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [Callpme] Installation des dependances (1re fois : long)...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo [Callpme] Demarrage du serveur sur http://localhost:8000
python server.py
pause
