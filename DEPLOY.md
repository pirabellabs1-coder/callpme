# Déploiement Callpme — Vercel + PostgreSQL (Supabase ou Neon)

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

**Supabase** (base actuelle) : bouton « Connect » du projet, rubrique pooler.
N'utilisez pas l'hôte direct `db.<projet>.supabase.co` (IPv6 seulement,
injoignable depuis Vercel).

- Application (Vercel, développement) : *Transaction pooler*, port `6543`,
  suffixe `?pgbouncer=true&connection_limit=5&connect_timeout=30` (sur Vercel,
  `connection_limit=1`). Le mode session sature dès que le tableau de bord
  lance ses requêtes en parallèle.
- `prisma db push` et serveur vocal (processus long) : *Session pooler*, même
  hôte, port `5432`. Exemple :
  `DATABASE_URL="postgresql://postgres.<projet>:<mot de passe>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" npx prisma db push`
- L'extension `vector` (base de connaissances) est créée par `db push`.

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

### Téléphonie (Twilio, Telnyx ou passerelle SIP)

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
- **Campagnes** : le serveur vocal compose les appels par lots toutes les
  30 s (plages horaires, appels simultanés, relances, liste d'opposition).
  Relais facultatif : un cron sur `GET /api/cron/campaigns` avec l'en-tête
  `Authorization: Bearer <CRON_SECRET>` (16 caractères minimum).
- **Résumé quotidien au gérant** : le serveur vocal fait le tour toutes les
  5 min et envoie à chaque organisation son résumé à son heure locale (défaut
  19 h, Réglages › Alertes), une fois par jour. Le cron horaire n'est pas dans
  `vercel.json` car l'offre Vercel Hobby refuse les crons plus fréquents
  qu'une fois par jour ; avec Vercel Pro ou un service externe, appelez
  `GET /api/cron/digest` toutes les heures (même en-tête `CRON_SECRET`).
  WhatsApp : créez chez Meta un modèle de message (catégorie « Utilitaire »)
  dont le corps contient un seul paramètre `{{1}}`, puis saisissez son nom
  dans les réglages ; sinon le résumé part par e-mail. Gardez le texte fixe du
  modèle court (moins de 120 caractères : Meta borne le corps à 1 024, le
  résumé en prend jusqu'à 900). Limite connue : Meta accepte l'envoi puis peut
  échouer plus tard (numéro absent de WhatsApp, modèle suspendu) ; dans ce
  cas aucun e-mail de repli ne part. Fuseau par défaut : celui du pays de
  l'organisation (Réglages › Organisation). Les conversations du widget web
  ne sont pas comptées (appels téléphoniques uniquement).
- **Touches du clavier** (« tapez 1 ») : transmises à l'agent pendant l'appel.
- **Fin d'appel** : les appels sortants déclarent `${PUBLIC_URL}/api/telephony/status`
  comme rappel de statut (non-réponse, occupé, échec) ; rien à configurer.
- **Achat de numéros** : les clients achètent leurs numéros depuis
  « Numéros » (compte opérateur de la plateforme, appels entrants déjà reliés).
  Pour la France, la Belgique ou la Suisse, Twilio exige un dossier
  réglementaire : renseignez `TWILIO_ADDRESS_SID` et `TWILIO_BUNDLE_SID`.
  Les prix affichés sont dans `src/lib/telephony/numbers.ts`.
- **Numéros** : un numéro ajouté à la main par un client est « en attente »
  tant qu'il n'a pas été vérifié. Seuls les numéros actifs reçoivent des
  appels, et un agent ne peut recevoir qu'un numéro de sa propre organisation.
  Vérification par l'équipe : espace d'administration, « Numéros à vérifier ».
- **Fraude** : activez les restrictions géographiques de l'opérateur (Twilio
  *Geo Permissions*, Telnyx *Outbound Voice Profile*) et bloquez les numéros
  surtaxés au niveau du compte, en plus des contrôles de l'application.
- Attribuez ensuite ce numéro à un agent dans le tableau de bord.
- **Test** : sans téléphone, la page « Tester » d'un agent permet de lui parler
  au micro via le même moteur.

### Passerelle SIP (opérateur local, sans Twilio)

Pour les pays où Twilio et Telnyx ne vendent pas de numéros (Afrique de
l'Ouest et centrale notamment), Callpme se raccorde directement à un opérateur
local (Orange, MTN, Moov, opérateur VoIP…) via un serveur Asterisk.

1. **Asterisk 18+** sur un serveur (VPS) avec les modules `app_audiosocket`,
   `func_curl` et `app_amd`. Modèles dans `infra/asterisk/`, à copier sans
   l'extension `.example` : `extensions.conf` (plan de numérotation),
   `pjsip.conf` (liaison opérateur), `ari.conf` (+ `http.conf`). Le secret va
   dans `callpme-secrets.conf` (`CALLPME_KEY=…`). Les vrais `.conf` sont
   ignorés par git : ne les commitez jamais.
2. **Liaison opérateur** : demandez à l'opérateur un « trunk SIP » (identifiant
   et mot de passe, ou authentification par IP) et les numéros associés.
   Codecs G.711 (`alaw`/`ulaw`).
3. **Application** : `TELEPHONY_PROVIDER=sip`, `ASTERISK_ARI_URL`
   (HTTPS, ex. `https://sip.votre-domaine.com:8089`), `ASTERISK_ARI_USER`,
   `ASTERISK_ARI_PASSWORD`, `SIP_GATEWAY_SECRET` (même valeur que `CALLPME_KEY`,
   24 caractères minimum, envoyé par Asterisk dans l'en-tête `X-Callpme-Key`),
   `SIP_FROM_NUMBER` (numéro présenté en sortant) et, si possible,
   `SIP_GATEWAY_ALLOW` (IP de l'Asterisk).
4. **Serveur vocal** : `VOICE_AUDIOSOCKET_PORT=4200` et
   `VOICE_AUDIOSOCKET_ALLOW=<IP de l'Asterisk>` (obligatoire : sans liste, le
   port reste fermé). Pare-feu : ce port ouvert uniquement à l'Asterisk.
5. **Sécurité de l'Asterisk** : ARI en HTTPS seulement (l'application sur
   Vercel n'a pas d'IP fixe) avec un mot de passe long ; port SIP 5060 ouvert
   aux seules IP de l'opérateur, fail2ban, aucun endpoint `anonymous`. La liste
   `CALLPME_ALLOWED` du plan de numérotation limite les pays composables ;
   demandez aussi un plafond de dépense à l'opérateur.
6. **Numéros** : le client déclare son numéro local dans « Numéros » ; il est
   activé après vérification par l'équipe (espace d'administration).

Fonctionnement : à l'arrivée d'un appel, Asterisk demande à l'application
(`/api/telephony/sip/inbound`) quel agent répond, puis ouvre le flux audio vers
le serveur vocal. En sortant (campagnes, rappels), l'application pilote Asterisk
via ARI ; la détection de répondeur et les non-réponses remontent par
`/api/telephony/sip/event`. Transfert vers un humain : géré par le plan de
numérotation. Les SMS ne passent pas par la passerelle SIP.
Rappel automatique en mode « bip » : l'application répond `CALLBACK` et le plan de
numérotation raccroche en « occupé » sans décrocher (`Hangup(17)`), puis l'agent
rappelle. Reprenez ce bloc d'`extensions.conf.example` si votre plan est plus ancien.
**À valider sur une vraie liaison opérateur avant la mise en production.**

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
