# Callpme — agents vocaux IA

Plateforme de création, de déploiement et de pilotage d'**agents vocaux IA**
pour les PME, les agences (marque blanche, multi-clients) et les développeurs
(API + webhooks). Marchés de départ : France, Belgique, Suisse, Québec et
Afrique francophone (paiement Mobile Money via GeniusPay).

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Prisma + **PostgreSQL**
(Neon) · Zod · Vapi (téléphonie) · Resend (e-mails) · GeniusPay (paiements) ·
Vitest (tests).

## Démarrage local

Prérequis : Node.js ≥ 18 et une base **PostgreSQL** (une base Neon gratuite
convient ; le CLI `npx neon link` écrit `DATABASE_URL` dans `.env`).

```bash
npm install
cp .env.example .env          # puis renseigner DATABASE_URL (et le reste au besoin)
npx prisma db push            # crée les tables
ALLOW_SEED=1 npm run db:seed  # données de démo — EFFACE la base : dev uniquement
npm run dev                   # http://localhost:3000
```

Compte de démo (base de développement uniquement) : `demo@callpme.dev` /
`demo1234`. Le seed refuse de s'exécuter en production et sans `ALLOW_SEED=1`.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm test` | Tests (Vitest) |
| `npm run db:seed` | Données de démo (avec `ALLOW_SEED=1`) |
| `npm run db:studio` | Explorer la base (Prisma Studio) |

La CI GitHub Actions (`.github/workflows/ci.yml`) lance typecheck, tests et
build sur chaque pull request.

## Structure

```
src/
├── app/
│   ├── (marketing)/   site public : accueil, produit, métiers, développeurs,
│   │                  tarifs, partenaires, contact, CGU, confidentialité, statut
│   ├── (auth)/        connexion, inscription, mot de passe
│   ├── (dashboard)/   espace client : agents, appels, statistiques, campagnes,
│   │                  modèles, clients, numéros, voix, connaissances, intégrations,
│   │                  développeurs, facturation, réglages
│   ├── (admin)/       administration de la plateforme (porte secrète)
│   ├── actions/       server actions (auth, facturation, contact…)
│   └── api/           API interne + API publique v1 (clé Bearer)
├── components/        UI par domaine + kit ui/
└── lib/               db (dépôts Prisma), auth, billing, telephony, net,
                       crypto, security, validation…
prisma/                schema.prisma (PostgreSQL) + seed.ts
tests/                 tests Vitest
```

## Sécurité (résumé)

- Toutes les routes applicatives sont privées par défaut (`src/middleware.ts`) ;
  chaque requête est cloisonnée par organisation.
- Actions sensibles (clés d'API, webhooks, intégrations, paiement) réservées
  au propriétaire et aux administrateurs.
- URL fournies par les utilisateurs protégées contre le SSRF
  (`src/lib/net/safe-fetch.ts`).
- Identifiants tiers chiffrés au repos (AES-256-GCM, `src/lib/crypto/secrets.ts`).
- Limites de tentatives sur l'authentification et les formulaires publics.
- Appels sortants réels limités aux pays couverts, au quota de l'offre, sans
  numéros surtaxés.

## Déploiement

Voir [DEPLOY.md](DEPLOY.md) et `.env.production.example`.

Les tarifs affichés sur le site sont dérivés de `src/lib/billing/plans.ts`,
seule source de vérité pour les prix et les limites.
