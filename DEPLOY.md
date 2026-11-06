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
| `VAPI_WEBHOOK_SECRET` | Secret du webhook Vapi ; sans lui, le webhook répond 503 |
| `ENCRYPTION_KEY` | Clé de chiffrement des identifiants tiers (≥ 32 caractères) — ne plus la changer ensuite |

**Selon les fonctionnalités utilisées** : `RESEND_API_KEY` + `RESEND_FROM`
(e-mails, domaine vérifié), `CONTACT_TO` (destinataire des formulaires du site),
`VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` (appels réels), `GENIUS_PAY_API_KEY` +
`GENIUS_PAY_API_SECRET` (paiements), `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
(connexion Google), `ADMIN_PASSPHRASE`, clés LLM/voix (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`).

## 3. Build

Le script `vercel-build` exécute `prisma generate && next build`. Sur Vercel :

- **Build Command** : `npm run vercel-build`
- **Install Command** : `npm install`

La CI (`.github/workflows/ci.yml`) vérifie typecheck, tests et build sur chaque
pull request.

## 4. Déployer

1. Fusionnez la pull request sur `main` une fois la CI verte.
2. Vercel → importez le dépôt → renseignez les variables → Deploy.
3. Vérifiez : `/statut` (base joignable), connexion, création d'un agent,
   formulaire de contact (réception de l'e-mail).

## 5. Limites connues

- Le limiteur de tentatives est en mémoire : sur plusieurs instances
  serverless, remplacez le stockage par Redis (ex. Upstash) — interface dans
  `src/lib/security/rate-limit.ts`.
- Les tarifs affichés viennent de `src/lib/billing/plans.ts` : modifiez-les à
  un seul endroit.
