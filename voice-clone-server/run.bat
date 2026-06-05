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
  echo Ferme puis rouvre ce terminal, et relance run.bat.
  echo.
  pause
  exit /b 1
)
echo [Callpme] Python detecte : %PY%

where ffmpeg >nul 2>&1 || (
  echo [ATTENTION] ffmpeg introuvable. Installe-le :  winget install Gyan.FFmpeg
  echo puis rouvre le terminal. On continue quand meme l'installation...
)

if not exist ".venv\Scripts\python.exe" (
  echo [Callpme] Creation de l'environnement Python...
  %PY% -m venv .venv
)
call ".venv\Scripts\activate.bat"

echo [Callpme] Mise a jour de pip...
python -m pip install --upgrade pip

python -c "import torch" 2>nul
if errorlevel 1 (
  echo [Callpme] Installation de PyTorch (version CPU, plus legere et fiable, ~200 Mo)...
  pip install --timeout 180 --retries 10 --prefer-binary torch --index-url https://download.pytorch.org/whl/cpu
) else (
  echo [Callpme] PyTorch deja present, on le conserve.
)

echo [Callpme] Installation des dependances Callpme (coqui-tts, fastapi...)...
pip install --timeout 180 --retries 10 --prefer-binary -r requirements.txt

REM Verifie que le serveur peut au moins demarrer avant de le lancer.
python -c "import fastapi, uvicorn, pydantic" 2>nul
if errorlevel 1 (
  echo.
  echo [ERREUR] Installation incomplete - probablement une coupure reseau.
  echo Relance simplement run.bat : pip reprend les telechargements manquants.
  echo.
  pause
  exit /b 1
)

echo [Callpme] Tout est installe. Demarrage du serveur...
echo [Callpme] (Au 1er appel, le modele XTTS ~2 Go se telecharge une seule fois.)
python server.py
pause
