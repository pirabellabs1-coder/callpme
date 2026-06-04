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
import tempfile
import threading

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

# --------------------------------------------------------------------------- #
#  Chargement du modèle (une seule fois au démarrage)                         #
# --------------------------------------------------------------------------- #
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[Callpme clone] Périphérique : {DEVICE} "
      f"({'GPU — rapide' if DEVICE == 'cuda' else 'CPU — fonctionne mais plus lent'})")

# Import tardif : le 1er chargement télécharge le modèle (~2 Go) puis le met en cache.
from TTS.api import TTS  # noqa: E402

print("[Callpme clone] Chargement de XTTS-v2… (peut prendre 1-2 min la 1re fois)")
_tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)
_lock = threading.Lock()  # XTTS n'est pas thread-safe : on sérialise les requêtes.
print("[Callpme clone] Prêt ✅  →  http://localhost:8000")

# Map des langues Callpme → codes XTTS.
LANG = {
    "fr-FR": "fr", "fr-BE": "fr", "fr-CA": "fr", "fr": "fr",
    "en-US": "en", "en-GB": "en", "en": "en",
    "es": "es", "de": "de", "it": "it", "nl": "nl", "pt": "pt",
}

# Cache des échantillons décodés (par empreinte) pour éviter de reconvertir.
_SAMPLE_DIR = os.path.join(tempfile.gettempdir(), "callpme_voices")
os.makedirs(_SAMPLE_DIR, exist_ok=True)

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
    # Conversion via ffmpeg (doit être installé et dans le PATH).
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


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "model": "xtts_v2"}


@app.post("/clone")
def clone(req: CloneReq):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Texte vide.")
    lang = LANG.get(req.language, "fr")
    speaker_wav = _decode_sample(req.sample)
    out_path = os.path.join(tempfile.gettempdir(), f"out_{os.getpid()}_{threading.get_ident()}.wav")
    with _lock:
        _tts.tts_to_file(
            text=text[:600],            # on borne la longueur d'un tour de parole
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
