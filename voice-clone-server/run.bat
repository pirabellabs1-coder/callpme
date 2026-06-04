@echo off
chcp 65001 >nul
REM Lanceur Windows - serveur de clonage vocal local Callpme
cd /d "%~dp0"

REM XTTS exige Python 3.10 ou 3.11 (PAS 3.12/3.13). On le detecte explicitement.
set "PY="
py -3.11 --version >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.10 --version >nul 2>&1 && set "PY=py -3.10"

if not defined PY (
  echo.
  echo [ERREUR] Python 3.11 ou 3.10 introuvable.
  echo XTTS ne fonctionne PAS avec Python 3.12 / 3.13.
  echo Installe Python 3.11 :   winget install Python.Python.3.11
  echo Installe aussi ffmpeg :  winget install Gyan.FFmpeg
  echo Rouvre ensuite ce dossier et relance run.bat.
  echo.
  pause
  exit /b 1
)
echo [Callpme] Python detecte : %PY%

REM Verifie ffmpeg (necessaire pour lire ton enregistrement).
where ffmpeg >nul 2>&1 || (
  echo.
  echo [ATTENTION] ffmpeg introuvable. Installe-le :  winget install Gyan.FFmpeg
  echo puis rouvre le terminal. On continue quand meme l'installation Python...
  echo.
)

if not exist ".venv\Scripts\python.exe" (
  echo [Callpme] Creation de l'environnement Python...
  %PY% -m venv .venv
)

call ".venv\Scripts\activate.bat"

echo [Callpme] Installation des dependances (1re fois : long, ~quelques Go)...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo [Callpme] Demarrage du serveur sur http://localhost:8000
python server.py
pause
