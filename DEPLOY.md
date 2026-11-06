# Déploiement Callpme — Vercel + PostgreSQL (Neon)

Le schéma Prisma est déjà en **PostgreSQL** (`prisma/schema.prisma`), en local
comme en production. Utilisez des bases distinctes : une base de développement
(ou une branche Neon) et une base de production.

## 1. Base de production

Créez un projet Neon (région UE, ex. `aws-eu-central-1`) ou une base Postgres
équivalente, puis récupérez l'URL `postgresql://…?sslmode=require` (préférez
l'URL « pooled » pour l'application).

Créez le schéma :

```bash
DATABASE_URL="postgresql://…" npx prisma db push
```

**Ne lancez jamais le seed en production** : il efface toutes les données. Il
refuse de toute façon de s'exécuter si `NODE_ENV=production` ou sans
`ALLOW_SEED=1`.

## 2. Variables d'environnement (Vercel → Settings → Environment Variables)

Modèle complet : [`.env.production.example`](.env.production.example).

**Obligatoires** — sans elles, les fonctions concernées refusent volontairement
de fonctionner :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Base PostgreSQL de production |
| `NEXTAUTH_SECRET` | Secret HMAC (≥ 32 caractères, `openssl rand -hex 32`) |
| `PUBLIC_URL` | URL publique (`https://votre-domaine.com`, sans slash final) |
| `ADMIN_GATE_SLUG` | Segment secret de la porte admin (`/portail/<slug>`) ; sans lui, l'admin est inaccessible |
| `ENCRYPTION_KEY` | Clé de chiffrement des identifiants tiers (≥ 32 caractères) — ne plus la changer ensuite |

**Selon les fonctionnalités utilisées** : `RESEND_API_KEY` + `RESEND_FROM`
(e-mails, domaine vérifié), `CONTACT_TO` (destinataire des formulaires du site),
`GENIUS_PAY_API_KEY` +
`GENIUS_PAY_API_SECRET` (paiements), `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
(connexion Google), `ADMIN_PASSPHRASE`, clés LLM/voix (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`).

## 3. Serveur vocal (moteur Callpme, remplace Vapi)

Le moteur vocal tourne dans un **service séparé** (`voice-server/`), car Vercel
ne garde pas de connexions WebSocket ouvertes. Il partage le code et la base de
données de l'application.

1. **Hébergement** : une machine qui garde les connexions ouvertes, en Europe
   pour la latence (Fly.io, Railway, Render, ou un VPS). Un `Dockerfile` est
   fourni dans `voice-server/`. Commande de démarrage : `npm run voice:start`.
2. **Variables** : les mêmes que l'application (`DATABASE_URL`,
   `NEXTAUTH_SECRET` identique, `ENCRYPTION_KEY`, clés LLM) **plus**
   `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY` ou `CARTESIA_API_KEY`,
   `VOICE_TTS_PROVIDER`, `VOICE_DEFAULT_FEMALE_ID`, `VOICE_DEFAULT_MALE_ID`.
   `NEXTAUTH_SECRET` doit être **le même** des deux côtés : il signe les jetons
   qui autorisent une session vocale.
3. **Application** : renseignez `VOICE_SERVER_URL` (`wss://voice.votre-domaine.com`)
   côté Vercel. Vérifiez `https://voice.votre-domaine.com/health`.

### Téléphonie (Twilio ou Telnyx)

- `TELEPHONY_PROVIDER` = `twilio` ou `telnyx`, avec les identifiants et le
  numéro d'appel sortant (`*_FROM_NUMBER`).
- **Appels entrants** : configurez le webhook « appel entrant » du numéro sur
  `https://votre-domaine.com/api/telephony/inbound` (POST). Twilio : « A call
  comes in » ; Telnyx : application TeXML (renseignez `TELNYX_TEXML_APP_ID` et
  `TELNYX_PUBLIC_KEY` pour la vérification de signature).
- Attribuez ensuite ce numéro à un agent dans le tableau de bord.
- **Test** : sans téléphone, la page « Tester » d'un agent permet de lui parler
  au micro via le même moteur.

## 4. Build

Le script `vercel-build` exécute `prisma generate && next build`. Sur Vercel :

- **Build Command** : `npm run vercel-build`
- **Install Command** : `npm install`

La CI (`.github/workflows/ci.yml`) vérifie typecheck, tests et build sur chaque
pull request.

## 5. Déployer

1. Fusionnez la pull request sur `main` une fois la CI verte.
2. Vercel → importez le dépôt → renseignez les variables → Deploy.
3. Vérifiez : `/statut` (base joignable), connexion, création d'un agent,
   formulaire de contact (réception de l'e-mail).

## 6. Limites connues

- Le limiteur de tentatives est en mémoire : sur plusieurs instances
  serverless, remplacez le stockage par Redis (ex. Upstash) — interface dans
  `src/lib/security/rate-limit.ts`.
- Le moteur vocal attend la réponse complète du LLM avant de parler : un
  passage au streaming LLM réduira encore la latence.
- Les tarifs affichés viennent de `src/lib/billing/plans.ts` : modifiez-les à
  un seul endroit.
