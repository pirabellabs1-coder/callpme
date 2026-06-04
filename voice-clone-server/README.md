# Serveur de clonage vocal local — Callpme

Fait parler tes agents avec **ta voix enregistrée**, sur **n'importe quel texte**,
**sans aucun service externe**. Le modèle (Coqui **XTTS-v2**, open-source) tourne
sur **ta** machine ; tes données ne sortent jamais de chez toi.

> ⚖️ **Licence** : XTTS-v2 est sous licence *Coqui Public Model License* (usage
> **non commercial**). Idéal pour tester et un usage perso. Pour une mise en
> production **commerciale**, on basculera sur un modèle à licence permissive
> (OpenVoice ou F5-TTS) — **la même intégration Callpme fonctionnera** (même API).

---

## 1. Pré-requis

- **Python 3.10 ou 3.11** (évite 3.12+). Vérifie : `py -3.11 --version`
- **ffmpeg** dans le PATH. Sur Windows : `winget install Gyan.FFmpeg` puis rouvre le terminal.
- **8 Go de RAM** minimum. Un **GPU NVIDIA** rend la voix quasi instantanée ;
  sur CPU ça marche mais compte ~5–20 s par phrase.

## 2. Lancer (Windows — le plus simple)

Double-clique **`run.bat`**. Il crée l'environnement, installe tout (long la 1re
fois : téléchargement du modèle ~2 Go), puis démarre le serveur.

Quand tu vois `Prêt ✅  →  http://localhost:8000`, c'est bon. **Laisse la
fenêtre ouverte** pendant que tu testes tes agents.

## 2 bis. Lancer (manuel / Mac / Linux)

```bash
cd voice-clone-server
python -m venv .venv
# Windows : .venv\Scripts\activate    |    Mac/Linux : source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

### Activer le GPU NVIDIA (fortement recommandé)
Avant `pip install -r requirements.txt`, installe la version CUDA de torch :
```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

## 3. Brancher Callpme

1. Va sur la page **Tester** d'un agent qui utilise **ta voix du Studio**.
2. Dans l'encart **« Voix clonée (serveur local) »**, l'URL est déjà
   `http://localhost:8000`. Clique **Vérifier** → tu dois voir **Connecté ✅**.
3. Lance l'appel : l'agent répond **avec ta voix**.

> Le navigateur (même sur https://www.callpme.com) a le droit d'appeler
> `http://localhost` — c'est une exception de sécurité prévue pour le local.
> Si tu héberges le serveur ailleurs, mets son URL **https** dans l'encart.

## 4. Dépannage

| Symptôme | Cause / solution |
|---|---|
| `ffmpeg introuvable` | Installe ffmpeg et rouvre le terminal. |
| `Connecté ❌` dans Callpme | Le serveur n'est pas lancé, ou un pare-feu bloque le port 8000. |
| Très lent | Tu es sur CPU → installe torch CUDA (GPU). |
| Erreur d'install `TTS` | Utilise Python 3.10/3.11 (pas 3.12+). |
| La voix ne ressemble pas assez | Réenregistre un échantillon **clair, ~15–30 s**, sans bruit, dans le Studio. |

## 5. API (pour info)

- `GET /health` → `{ ok, device, model }`
- `POST /clone` `{ text, sample (data URL de ton enregistrement), language }` → audio WAV
