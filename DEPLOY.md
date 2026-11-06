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

Une base déjà créée avec l'ancien schéma (Vapi) demande
`npx prisma db push --accept-data-loss` : la colonne `Contact.vapiCallId` est
remplacée par `providerCallId` (identifiants d'appels Vapi, sans usage).

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
   qui autorisent une session vocale. Sans lui (ou s'il fait moins de 32
   caractères), le serveur vocal refuse de démarrer.
   Capacité : `VOICE_MAX_SESSIONS` (total), `VOICE_MAX_PER_ORG` (par client).
   **Une seule instance** pour l'instant : les jetons à usage unique sont
   mémorisés en mémoire (passer à Redis avant de multiplier les instances).
3. **Application** : renseignez `VOICE_SERVER_URL` (`wss://voice.votre-domaine.com`)
   côté Vercel. Vérifiez `https://voice.votre-domaine.com/health`.

### Actions des agents (agenda, prospects, SMS)

- **Agenda intégré** : fonctionne sans configuration (horaires réglés par agent).
- **Google Agenda** : dans la console Google Cloud, activez l'API Google
  Calendar et ajoutez l'URI de redirection
  `https://votre-domaine.com/api/integrations/google/callback` au client OAuth
  (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Les clients se connectent
  ensuite depuis « Intégrations ».
- **HubSpot / Pipedrive** : jeton saisi par le client dans « Intégrations ».
- **SMS** : le numéro de l'opérateur doit pouvoir envoyer des SMS
  (`TWILIO_SMS_FROM` / `TELNYX_SMS_FROM` s'il diffère du numéro d'appel).
- **E-mails de suivi** : via Resend (`RESEND_API_KEY`).
- Nouvelles tables (`Appointment`, `Lead`, `DailyCounter`, `KnowledgeChunk`) :
  `npx prisma db push`. La base de connaissances utilise l'extension
  PostgreSQL **pgvector** (activée automatiquement sur Neon par `db push`).
- **Base de connaissances** : import de PDF (4 Mo, 300 pages), fichiers texte, pages et sites
  web ; recherche plein texte en français sans configuration, recherche par
  le sens si `OPENAI_API_KEY` est défini (modèle `EMBEDDING_MODEL`).

### Téléphonie (Twilio ou Telnyx)

- `TELEPHONY_PROVIDER` = `twilio` ou `telnyx`, avec les identifiants et le
  numéro d'appel sortant (`*_FROM_NUMBER`).
- **Appels entrants** : configurez le webhook « appel entrant » du numéro sur
  `https://votre-domaine.com/api/telephony/inbound` (POST). Twilio : « A call
  comes in » ; Telnyx : application TeXML (renseignez `TELNYX_TEXML_APP_ID` et
  `TELNYX_PUBLIC_KEY` pour la vérification de signature).
- **Appels sortants et répondeurs** : au décroché, l'opérateur appelle
  `${PUBLIC_URL}/api/telephony/answer` avec la détection de répondeur
  (Twilio et Telnyx « DetectMessageEnd ») : l'agent parle à un humain, laisse
  un message après le bip ou raccroche, selon le réglage de l'agent.
- **Touches du clavier** (« tapez 1 ») : transmises à l'agent pendant l'appel.
- **Fin d'appel** : les appels sortants déclarent `${PUBLIC_URL}/api/telephony/status`
  comme rappel de statut (non-réponse, occupé, échec) ; rien à configurer.
- **Numéros** : un numéro ajouté à la main par un client est « en attente »
  tant qu'il n'a pas été vérifié. Seuls les numéros actifs reçoivent des
  appels, et un agent ne peut recevoir qu'un numéro de sa propre organisation.
- **Fraude** : activez les restrictions géographiques de l'opérateur (Twilio
  *Geo Permissions*, Telnyx *Outbound Voice Profile*) et bloquez les numéros
  surtaxés au niveau du compte, en plus des contrôles de l'application.
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
- Une communication transférée vers un humain est plafonnée à 10 minutes et
  n'est pas encore décomptée du quota du client.
- Telnyx : le transfert et le mode audio bidirectionnel sont à valider sur un
  vrai appel avant l'ouverture commerciale.
- Le moteur vocal attend la réponse complète du LLM avant de parler : un
  passage au streaming LLM réduira encore la latence.
- Les tarifs affichés viennent de `src/lib/billing/plans.ts` : modifiez-les à
  un seul endroit.
