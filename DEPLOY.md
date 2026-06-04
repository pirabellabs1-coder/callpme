# Déploiement Callpme — Vercel + PostgreSQL

En local, Callpme tourne sur **SQLite** (zéro configuration). Pour la **production**,
il faut une vraie base **PostgreSQL** (le système de fichiers de Vercel est éphémère :
SQLite n'y est pas persistant). Le schéma est déjà conçu pour être portable
(JSON stocké en TEXT), donc le passage à Postgres est direct.

## 1. Créer une base PostgreSQL

Au choix (offre gratuite suffisante pour démarrer) :

- **Vercel Postgres** : Vercel → Storage → Create Database → Postgres.
- **Neon** : https://neon.tech → New Project → copier la connection string.
- **Supabase** : https://supabase.com → Project → Database → Connection string.

Récupérez l'URL `postgresql://...` (avec `?sslmode=require`).

## 2. Basculer Prisma sur PostgreSQL

Dans `prisma/schema.prisma`, changez **une seule ligne** :

```prisma
datasource db {
  provider = "postgresql"   // était "sqlite"
  url      = env("DATABASE_URL")
}
```

Puis, en pointant `DATABASE_URL` vers votre base Postgres :

```bash
npx prisma generate
npx prisma db push        # crée les tables sur Postgres
# (optionnel) npm run db:seed   # données de démo — à NE PAS faire en prod réelle
```

> Astuce : gardez `provider = "sqlite"` pour le dev local et `"postgresql"` pour la
> prod. Si vous voulez Postgres aussi en local, lancez une base Neon de dev.

## 3. Variables d'environnement (Vercel)

Project → Settings → Environment Variables — copiez celles de
[`.env.production.example`](.env.production.example) :

- `DATABASE_URL` (Postgres)
- `NEXTAUTH_SECRET` (`openssl rand -hex 32`)
- `PUBLIC_URL` (`https://votre-domaine.com`)
- `RESEND_API_KEY` + `RESEND_FROM` (adresse de votre **domaine vérifié**)
- (optionnel) `ELEVENLABS_API_KEY`, `CARTESIA_API_KEY`, `OPENAI_API_KEY`, etc.

## 4. Build

`package.json` doit exécuter `prisma generate` avant le build (déjà géré si
`postinstall` lance `prisma generate`). Sinon, sur Vercel :

- **Build Command** : `prisma generate && next build`
- **Install Command** : `npm install`

## 5. Déployer

1. Poussez le repo sur GitHub.
2. Vercel → New Project → importez le repo → réglez les variables → Deploy.
3. Après le 1er déploiement : `npx prisma db push` contre `DATABASE_URL` (ou via un
   script de release) pour créer le schéma.

## 6. Mise en production « propre »

- Connectez-vous en **admin** → **Revenus & métriques** → **Zone de danger** →
  **Purger les données de démonstration** pour partir d'une base 100 % réelle.
- Vérifiez que `RESEND_FROM` utilise bien votre domaine vérifié (sinon les e-mails
  échouent).
- **Régénérez** toutes les clés qui ont pu transiter en clair (Resend, token Vercel).
