# 📞 Callpme — Plateforme d'agents vocaux IA

Plateforme française de création, déploiement et orchestration d'**agents vocaux IA**
spécialisés par **rôle** (support, prise de rendez-vous, qualification, vente,
standard, enquête). Pensée pour les agences qui gèrent plusieurs clients.

> **État de cette itération :** Phases 1 & 2 du cahier des charges — le système
> **multi-agents avec rôles** et tout le dashboard, **entièrement fonctionnel**.
> La partie vocale temps réel (Phase 3) est cadrée et stubée, prête à être branchée.

---

## ✨ Ce qui est livré

- **Cœur multi-agents par rôle** — 6 rôles, chacun avec son template de system
  prompt, ses outils par défaut et son premier message ([`role-templates.ts`](src/lib/agents/role-templates.ts)).
- **CRUD agents complet** — API REST + UI.
- **Assistant de création en 5 étapes** — rôle, voix, cerveau (LLM + prompt
  généré et éditable), outils & garde-fous, téléphonie — avec **aperçu d'appel en direct**.
- **Logs d'appels & transcripts** — vue chat, résumé IA, outils invoqués, issue.
- **Analytics** — taux de résolution, durée moyenne, transferts, satisfaction,
  volume (graphiques **SVG sur-mesure**, aucune dépendance de charting).
- **Numéros & Réglages** — inventaire de numéros, équipe, intégrations.
- **Landing marketing** — hero, rôles, pipeline d'appel, tarifs, FAQ.
- **Données de démonstration** — une agence, 6 agents (tous les rôles), 130 appels.

## 🎨 Identité visuelle

Design sur-mesure, **pas de look « généré par IA »** : blanc cassé chaud dominant,
orange de marque `#E8572A`, encre noire chaude, bordures fines 1px, ombres douces.
Typographie **Geist** (locale, zéro dépendance réseau). **Icônes Lucide réelles,
aucune emoji, aucun dégradé multicolore.** Esprit Linear / Stripe.

---

## 🚀 Démarrage rapide

Prérequis : **Node.js ≥ 18** (testé sur Node 24), npm.

```bash
# 1. Installer
npm install

# 2. Préparer la base (SQLite locale) + données de démo
npm run setup        # = prisma generate + db push + db seed

# 3. Lancer
npm run dev          # http://localhost:3000
```

La landing est sur `/`, le tableau de bord sur `/overview`.

### Scripts

| Script | Rôle |
|--------|------|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run start` | Build & serveur de production |
| `npm run setup` | Génère le client Prisma, crée la base, seed |
| `npm run db:seed` | (Re)génère les données de démonstration |
| `npm run db:studio` | Prisma Studio (explorer la base) |
| `npm run db:reset` | Réinitialise la base |

---

## 🏗️ Architecture & décisions

Application **Next.js 14 (App Router, TypeScript, Tailwind)** unique, à frontières
de modules nettes — plus fiable à exécuter qu'un monorepo, et extractible plus tard.

```
src/
├── app/
│   ├── (marketing)/         # Landing publique  ->  /
│   ├── (dashboard)/         # Dashboard (sidebar)  ->  /overview, /agents, /calls...
│   └── api/                 # Routes REST (agents, calls)
├── components/
│   ├── ui/                  # Kit UI de marque (Button, Card, Switch...)
│   ├── agents/ · calls/ · charts/ · dashboard/ · marketing/
│   └── role-badge.tsx · status-badges.tsx · icon.tsx
└── lib/
    ├── shared/types.ts      # Contrat de types (≈ packages/shared)
    ├── agents/              # roles · role-templates · catalog   <- cœur différenciant
    ├── tools/registry.ts    # Outils (function calling)
    ├── telephony/           # Inventaire de numéros
    ├── db/                  # Prisma client + dépôts (≈ packages/db)
    └── validation/          # Schémas Zod
prisma/                      # schema.prisma (SQLite) + seed.ts
```

**Décisions clés**

- **SQLite en local** (zéro Docker, démarrage immédiat). Le schéma est calqué sur
  la spec ; les champs riches (`config`, `transcript`) sont stockés en **TEXT JSON**
  pour la portabilité — ils deviennent `Json`/`jsonb` sur PostgreSQL. La
  (dé)sérialisation typée vit dans [`src/lib/db`](src/lib/db).
- **`src/lib` en imports relatifs** entre modules → réutilisable par le seed (`tsx`)
  et extractible en `packages/` sans rien changer. L'app utilise l'alias `@/`.
- **Providers interchangeables** — voix, LLM et STT sont des données de
  configuration ([`catalog.ts`](src/lib/agents/catalog.ts)), jamais codés en dur.

---

## 🤖 Rôles & génération de prompt

Chaque rôle ([`roles.ts`](src/lib/agents/roles.ts)) porte libellé, description,
icône, teinte sobre, outils par défaut et premier message. `generateSystemPrompt()`
([`role-templates.ts`](src/lib/agents/role-templates.ts)) compose un prompt complet :
socle commun (style oral, discipline d'outils, escalade) + bloc métier du rôle +
garde-fous + personnalité.

| Rôle | Outils par défaut |
|------|-------------------|
| `support` | lookupOrder, createTicket, transferToHuman, endCall |
| `appointment` | checkAvailability, bookAppointment, cancelAppointment... |
| `lead_qualification` | scoreLead, saveToCRM, scheduleCallback... |
| `outbound_sales` | logCall, sendFollowUpEmail, markInterested... |
| `receptionist` | routeCall, takeMessage, transferToHuman... |
| `survey` | recordAnswer, submitSurvey, endCall |

## 🔌 API REST

```
GET    /api/agents                      Lister (filtres : role, status, search)
POST   /api/agents                      Créer
GET    /api/agents/:id                  Détail
PATCH  /api/agents/:id                  Modifier
DELETE /api/agents/:id                  Supprimer
POST   /api/agents/:id/assign-number    Assigner un numéro
POST   /api/agents/:id/test             Test d'appel (stub Phase 3)
GET    /api/calls                       Logs (filtres : agent, status, direction...)
GET    /api/calls/:id                   Transcript complet
```

---

## 🗺️ Suite (Phase 3+)

La couche voix est volontairement hors périmètre ici, mais tout est prêt :

- **Serveur média dédié** (`apps/voice-server`) — WebSocket Twilio Media Streams.
- **Pipeline** STT (Deepgram) → LLM → TTS (ElevenLabs), branché sur les outils
  existants ([`registry.ts`](src/lib/tools/registry.ts) → `executeTool`).
- **Test navigateur (WebRTC)** avant la téléphonie réelle.
- **Auth multi-tenant** (le modèle l'est déjà ; remplacer [`getCurrentOrg`](src/lib/db/context.ts)
  par la session).
- **PostgreSQL** en production (changer le `provider` Prisma + `Json`).

Les variables d'environnement correspondantes sont listées dans [`.env.example`](.env.example).

---

## 🧱 Stack

Next.js 14 · TypeScript · Tailwind CSS · Prisma (SQLite → PostgreSQL) · Zod ·
Lucide · date-fns · Geist.

*Callpme — document vivant, à itérer au fil du développement.*
