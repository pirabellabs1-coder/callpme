@echo off
chcp 65001 >nul
REM Lanceur Windows - serveur de clonage vocal local Callpme
cd /d "%~dp0"

REM XTTS exige Python 3.10 ou 3.11 (PAS 3.12/3.13).
set "PY="
py -3.11 --version >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.10 --version >nul 2>&1 && set "PY=py -3.10"
if not defined PY goto NO_PYTHON
echo [Callpme] Python detecte : %PY%

if not exist ".venv\Scripts\python.exe" %PY% -m venv .venv
call ".venv\Scripts\activate.bat"

echo [Callpme] Mise a jour de pip...
python -m pip install --upgrade pip --quiet

python -c "import torch" 2>nul
if not errorlevel 1 goto AFTER_TORCH
echo [Callpme] Installation de PyTorch CPU - leger et fiable, ~200 Mo...
pip install --timeout 180 --retries 10 --prefer-binary torch --index-url https://download.pytorch.org/whl/cpu
:AFTER_TORCH

echo [Callpme] Installation des dependances Callpme - coqui-tts, fastapi, ffmpeg embarque...
pip install --timeout 180 --retries 10 --prefer-binary -r requirements.txt

python -c "import fastapi, uvicorn, pydantic" 2>nul
if errorlevel 1 goto INSTALL_FAILED

echo.
echo [Callpme] Tout est installe. Demarrage du serveur...
echo [Callpme] Au 1er appel, le modele XTTS se telecharge une seule fois.
echo.
python server.py
pause
goto :EOF

:NO_PYTHON
echo.
echo [ERREUR] Python 3.11 ou 3.10 introuvable.
echo XTTS ne marche pas avec Python 3.12 / 3.13.
echo Installe Python 3.11 :   winget install Python.Python.3.11
echo Ferme puis rouvre le terminal, et relance run.bat.
echo.
pause
exit /b 1

:INSTALL_FAILED
echo.
echo [ERREUR] Installation incomplete - probablement une coupure reseau.
echo Relance simplement run.bat : pip reprend les telechargements manquants.
echo.
pause
exit /b 1
