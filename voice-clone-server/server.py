"""
Serveur de clonage vocal auto-hébergé pour Callpme — 100 % local, aucun service externe.

Il prend un texte + un échantillon de TA voix (enregistré dans le Studio) et
renvoie l'audio du texte prononcé AVEC ta voix, grâce au modèle open-source
Coqui XTTS-v2 (multilingue, français inclus, clonage à partir de ~6 s d'audio).

Lancement :
    pip install -r requirements.txt        (voir README.md)
    python server.py                       (ou : uvicorn server:app --port 8000)

Le navigateur de Callpme appelle ce serveur sur http://localhost:8000.
"""
import base64
import hashlib
import os
import subprocess
import sys
import tempfile
import threading

# Console Windows : évite les crashs d'encodage (UnicodeEncodeError cp1252) sur
# les caractères accentués / symboles dans les messages.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Accepte la licence du modèle de façon NON-INTERACTIVE (sinon le 1er
# chargement bloque en attendant une saisie clavier).
os.environ.setdefault("COQUI_TOS_AGREED", "1")

import torch  # noqa: E402

# Correctif torch >= 2.6 : `weights_only=True` est devenu le défaut et casse le
# chargement de XTTS (« WeightsUnpickler error »). On rétablit l'ancien comportement.
_ORIG_TORCH_LOAD = torch.load
def _safe_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _ORIG_TORCH_LOAD(*args, **kwargs)
torch.load = _safe_torch_load

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from pydantic import BaseModel  # noqa: E402

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Map des langues Callpme → codes XTTS.
LANG = {
    "fr-FR": "fr", "fr-BE": "fr", "fr-CA": "fr", "fr": "fr",
    "en-US": "en", "en-GB": "en", "en": "en",
    "es": "es", "de": "de", "it": "it", "nl": "nl", "pt": "pt",
}

_SAMPLE_DIR = os.path.join(tempfile.gettempdir(), "callpme_voices")
os.makedirs(_SAMPLE_DIR, exist_ok=True)

# --------------------------------------------------------------------------- #
#  Chargement PARESSEUX du modèle : le serveur démarre vite et /health répond  #
#  immédiatement ; le modèle (~2 Go) ne se charge qu'au 1er clonage.           #
# --------------------------------------------------------------------------- #
_tts = None
_lock = threading.Lock()


def _get_tts():
    global _tts
    if _tts is None:
        with _lock:
            if _tts is None:
                from TTS.api import TTS  # import tardif
                print(f"[Callpme clone] Chargement de XTTS-v2 sur {DEVICE}... "
                      "(1re fois : telechargement ~2 Go puis mise en cache)")
                _tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)
                print("[Callpme clone] Modele pret -- l'agent peut parler avec ta voix.")
    return _tts


def _decode_sample(sample: str) -> str:
    """Décode l'échantillon (webm/ogg/wav…) et le convertit en WAV mono 22 kHz."""
    if sample.startswith("data:") and "," in sample:
        sample = sample.split(",", 1)[1]
    raw = base64.b64decode(sample)
    digest = hashlib.sha1(raw).hexdigest()[:16]
    wav_path = os.path.join(_SAMPLE_DIR, f"{digest}.wav")
    if os.path.exists(wav_path):
        return wav_path
    src_path = os.path.join(_SAMPLE_DIR, f"{digest}.bin")
    with open(src_path, "wb") as f:
        f.write(raw)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-ar", "22050", "-ac", "1", wav_path],
            check=True, capture_output=True,
        )
    except FileNotFoundError:
        raise HTTPException(500, "ffmpeg introuvable — installez-le (voir README.md).")
    except subprocess.CalledProcessError as e:
        raise HTTPException(400, f"Échantillon illisible : {e.stderr.decode()[:200]}")
    finally:
        if os.path.exists(src_path):
            os.remove(src_path)
    return wav_path


app = FastAPI(title="Callpme — Clonage vocal local")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # le navigateur (callpme.com) doit pouvoir appeler localhost
    allow_methods=["*"],
    allow_headers=["*"],
)


class CloneReq(BaseModel):
    text: str
    sample: str            # data URL ou base64 brut de l'enregistrement
    language: str = "fr-FR"


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "model": "xtts_v2", "loaded": _tts is not None}


@app.post("/clone")
def clone(req: CloneReq):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Texte vide.")
    lang = LANG.get(req.language, "fr")
    speaker_wav = _decode_sample(req.sample)
    tts = _get_tts()
    out_path = os.path.join(
        tempfile.gettempdir(), f"out_{os.getpid()}_{threading.get_ident()}.wav"
    )
    with _lock:  # XTTS n'est pas thread-safe : on sérialise les inférences.
        tts.tts_to_file(
            text=text[:600],
            speaker_wav=speaker_wav,
            language=lang,
            file_path=out_path,
        )
    with open(out_path, "rb") as f:
        data = f.read()
    try:
        os.remove(out_path)
    except OSError:
        pass
    return Response(content=data, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    print("[Callpme clone] Demarrage ->  http://localhost:8000  (laisse cette fenetre ouverte)")
    uvicorn.run(app, host="0.0.0.0", port=8000)
