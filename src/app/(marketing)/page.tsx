import Link from "next/link";
import {
  ArrowRight,
  Check,
  Terminal,
  Webhook,
  Code2,
  PlugZap,
  ShieldCheck,
  BarChart3,
  PhoneIncoming,
  AudioLines,
  BrainCircuit,
  Volume2,
  ChevronDown,
  Building2,
  BookOpen,
  Megaphone,
} from "lucide-react";
import { ALL_ROLE_META, ROLE_META } from "@/lib/agents/roles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DynamicIcon } from "@/components/icon";
import { CallPreview } from "@/components/agents/wizard/call-preview";
import { CodeBlock, CodeTabs } from "@/components/dev/code-block";

const API_BASE = "https://www.callpme.com/api/v1";

/* --- Code copiable : création d'un agent (curl, JS, Python) --- */
const HERO_CURL = [
  `curl -X POST ${API_BASE}/agents \\`,
  `  -H "Authorization: Bearer cpk_live_..." \\`,
  `  -H "Content-Type: application/json" \\`,
  `  -d '{`,
  `    "name": "Standard Accueil",`,
  `    "role": "receptionist",`,
  `    "firstMessage": "Bonjour, bienvenue chez Acme !"`,
  `  }'`,
].join("\n");

const CREATE_SAMPLES = [
  { label: "cURL", language: "bash", code: HERO_CURL },
  {
    label: "JavaScript",
    language: "javascript",
    code: [
      `const res = await fetch("${API_BASE}/agents", {`,
      '  method: "POST",',
      "  headers: {",
      "    Authorization: `Bearer ${process.env.CALLPME_KEY}`,",
      '    "Content-Type": "application/json",',
      "  },",
      "  body: JSON.stringify({",
      '    name: "Standard Accueil",',
      '    role: "receptionist",',
      '    firstMessage: "Bonjour, bienvenue chez Acme !",',
      "  }),",
      "});",
      "const { data } = await res.json();",
    ].join("\n"),
  },
  {
    label: "Python",
    language: "python",
    code: [
      "import requests",
      "",
      "res = requests.post(",
      `    "${API_BASE}/agents",`,
      '    headers={"Authorization": f"Bearer {CALLPME_KEY}"},',
      "    json={",
      '        "name": "Standard Accueil",',
      '        "role": "receptionist",',
      '        "firstMessage": "Bonjour, bienvenue chez Acme !",',
      "    },",
      ")",
      'print(res.json()["data"]["id"])',
    ].join("\n"),
  },
];

const WEBHOOK_CODE = [
  "{",
  '  "event": "call.completed",',
  '  "data": {',
  '    "id": "call_3a9…",',
  '    "agentId": "agt_8f2c…",',
  '    "durationSec": 132,',
  '    "outcome": "Rendez-vous pris",',
  '    "satisfaction": 5',
  "  },",
  '  "timestamp": "2026-06-05T10:00:00.000Z"',
].join("\n") + "\n}";

const DEV_POINTS = [
  { icon: Code2, title: "API REST claire", text: "Créez, listez et pilotez vos agents et vos appels en quelques requêtes." },
  { icon: Webhook, title: "Webhooks signés", text: "Recevez chaque événement d'appel, vérifiés par signature HMAC." },
  { icon: PlugZap, title: "Fonctions sur-mesure", text: "Branchez vos propres endpoints : l'agent appelle vos outils en direct." },
];

const STATS = [
  { value: "6", label: "rôles prêts à l'emploi" },
  { value: "17", label: "voix françaises" },
  { value: "<1s", label: "latence cible" },
  { value: "100%", label: "conforme RGPD" },
];

const PIPELINE = [
  { icon: PhoneIncoming, title: "Appel entrant", text: "Le numéro reçoit l'appel et identifie l'agent assigné." },
  { icon: AudioLines, title: "Transcription", text: "La parole est transcrite en temps réel (STT)." },
  { icon: BrainCircuit, title: "Compréhension", text: "Le modèle raisonne avec le prompt du rôle et appelle les outils." },
  { icon: Volume2, title: "Réponse vocale", text: "La réponse est synthétisée et renvoyée à l'appelant (TTS)." },
];

const CAPABILITIES = [
  { icon: Megaphone, title: "Campagnes sortantes", text: "Importez vos contacts, l'agent appelle toute la liste et journalise chaque issue." },
  { icon: AudioLines, title: "Studio Voix", text: "Enregistrez, mixez et clonez des voix sur-mesure pour vos agents." },
  { icon: Building2, title: "Multi-clients", text: "Un espace isolé par client, en marque blanche, prêt pour la revente." },
  { icon: BookOpen, title: "Base de connaissances", text: "Vos agents répondent depuis vos documents et vos URLs (RAG)." },
  { icon: ShieldCheck, title: "Garde-fous", text: "Fixez des limites strictes par agent et gardez le contrôle de ce qui est dit." },
  { icon: BarChart3, title: "Statistiques", text: "Taux de résolution, durée, transferts, satisfaction — tout est mesuré." },
];

const PRICING = [
  { id: "starter", name: "Starter", price: "49 €", period: "/ mois", desc: "Pour démarrer avec un premier agent.", features: ["1 agent vocal", "1 numéro inclus", "500 minutes / mois", "Statistiques de base"], cta: "Commencer", highlight: false },
  { id: "pro", name: "Pro", price: "149 €", period: "/ mois", desc: "Pour les équipes qui industrialisent.", features: ["10 agents vocaux", "5 numéros inclus", "3 000 minutes / mois", "Statistiques avancées", "Webhooks & API complète"], cta: "Choisir Pro", highlight: true },
  { id: "agency", name: "Agence", price: "Sur devis", period: "", desc: "Pour gérer plusieurs clients.", features: ["Agents illimités", "Multi-organisations", "Numéros à volume", "Support dédié", "Engagement SLA"], cta: "Nous contacter", highlight: false },
];

const FAQ = [
  { q: "Qu'est-ce qu'un agent vocal avec un rôle ?", a: "Un agent est une entité configurable (voix, modèle, prompt, outils) à laquelle vous assignez un rôle — support, prise de rendez-vous, qualification, vente… Le rôle pré-remplit automatiquement le prompt et les outils adaptés." },
  { q: "Puis-je tout piloter par API ?", a: "Oui. Toute la plateforme est accessible via une API REST authentifiée par clé : créer des agents, lancer des campagnes, lire les appels et leurs transcripts, et recevoir des webhooks signés à chaque événement." },
  { q: "Mes données sont-elles hébergées en France ?", a: "La plateforme est pensée pour la conformité RGPD avec un hébergement en Europe. Vous gardez la maîtrise de vos transcripts et de vos enregistrements." },
  { q: "Comment fonctionne la facturation des appels ?", a: "Chaque offre inclut un volume de minutes. Au-delà, les minutes sont facturées à l'usage. Les numéros sont facturés séparément, à partir de 2 € par mois." },
];

export default function LandingPage() {
  return (
    <>
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]" />
        <div className="container-marketing relative grid items-center gap-12 py-16 lg:grid-cols-[1fr_1.05fr] lg:py-24">
          {/* Colonne texte */}
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs font-medium text-foreground/70 shadow-xs">
              <Terminal className="size-3.5 text-brand" />
              voix-ai · piloté par API · conçu en France
            </span>
            <h1 className="mt-6 text-display-xl font-semibold tracking-tight text-foreground text-balance">
              Déployez des agents vocaux IA en{" "}
              <span className="relative text-brand">
                quelques lignes
                <Underline />
              </span>{" "}
              de code.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
              Support, rendez-vous, qualification, vente… Créez des agents
              spécialisés, branchez-les à vos numéros, et pilotez chaque appel
              par API ou depuis le tableau de bord.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "brand", size: "lg" }), "gap-1.5")}
              >
                Créer un agent
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#developpeurs"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-1.5")}
              >
                <Code2 className="size-4" />
                Voir l'API
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Sans engagement</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Hébergement FR</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-emerald-600" /> Conforme RGPD</span>
            </div>
          </div>

          {/* Colonne visuel : fenêtre de code (signature) */}
          <div className="relative min-w-0">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-70"
              style={{ background: "radial-gradient(closest-side, hsl(14 81% 54% / 0.12), transparent)" }}
            />
            <TerminalWindow title="POST /api/v1/agents">
              <CodeBlock code={HERO_CURL} language="bash" className="border-0 bg-transparent" />
            </TerminalWindow>
          </div>
        </div>

        {/* Bandeau stats */}
        <div className="container-marketing relative pb-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card px-6 py-7 text-center">
                <p className="tabular text-display-sm font-semibold tracking-tight text-foreground">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── COMPATIBILITÉS ─────────────────── */}
      <section className="border-b border-border py-10">
        <div className="container-marketing">
          <p className="text-center font-mono text-xs uppercase tracking-wider text-muted-foreground/70">
            Branché à votre stack
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Twilio", "Zadarma", "OpenAI", "Anthropic", "Mistral", "ElevenLabs", "Deepgram", "Google Agenda", "HubSpot", "Slack", "Zapier"].map((n) => (
              <span key={n} className="text-sm font-semibold text-foreground/35">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── DÉVELOPPEURS ───────────────────── */}
      <section id="developpeurs" className="border-b border-border bg-foreground py-14 sm:py-20 text-white">
        <div className="container-marketing grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">Pour les développeurs</p>
            <h2 className="mt-3 text-display-md font-semibold tracking-tight text-white text-balance">
              Une API, pas une boîte noire.
            </h2>
            <p className="mt-4 max-w-lg text-white/60 text-pretty">
              Tout ce que vous faites dans l'interface est disponible par API :
              créez des agents, lancez des campagnes, lisez les transcripts,
              recevez les événements en webhook. Copiez, collez, déployez.
            </p>
            <div className="mt-8 space-y-5">
              {DEV_POINTS.map((p) => (
                <div key={p.title} className="flex gap-3.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand ring-1 ring-inset ring-white/10 [&_svg]:size-4">
                    <p.icon strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-sm text-white/55 text-pretty">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
            >
              Obtenir une clé API
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="space-y-4 min-w-0">
            <CodeTabs samples={CREATE_SAMPLES} />
            <div className="grid gap-2">
              <p className="font-mono text-xs uppercase tracking-wider text-white/40">
                Webhook · call.completed
              </p>
              <CodeBlock code={WEBHOOK_CODE} language="json" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── APERÇU PRODUIT (bento) ─────────────────── */}
      <section className="border-b border-border py-14 sm:py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Le produit"
            title="Un cockpit complet, pas qu'une API"
            subtitle="Tableau de bord, test au micro dans le navigateur, studio voix — tout est là."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <DashboardMockup />
            <div className="grid gap-5">
              <CallPreview
                name="Léa — Rendez-vous"
                role="appointment"
                firstMessage={ROLE_META.appointment.firstMessage}
                voiceLabel="Léa"
                language="fr-FR"
                modelLabel="Claude"
                temperature={0.5}
                toolsCount={3}
              />
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-5">
                  <AudioLines strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Studio Voix</p>
                  <p className="text-xs text-muted-foreground">Enregistrez et clonez votre voix.</p>
                </div>
                <Waveform />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── RÔLES ───────────────────────── */}
      <section id="roles" className="border-b border-border py-14 sm:py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Rôles"
            title="Un rôle pour chaque appel"
            subtitle="Chaque rôle arrive avec son prompt, ses outils et son premier message — prêt en quelques secondes."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLE_META.map((meta) => (
              <div key={meta.key} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className={cn("inline-flex size-12 items-center justify-center rounded-xl [&_svg]:size-6", meta.iconWrapClass)}>
                  <DynamicIcon name={meta.icon} />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight text-foreground">{meta.label}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{meta.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {meta.defaultTools.slice(0, 3).map((tool) => (
                    <span key={tool} className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{tool}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── PIPELINE ───────────────────── */}
      <section className="border-b border-border bg-card/40 py-14 sm:py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Sous le capot"
            title="Le parcours d'un appel"
            subtitle="Une boucle voix temps réel, du décroché à la réponse, avec moins d'une seconde de latence cible."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-foreground text-white [&_svg]:size-5">
                      <step.icon strokeWidth={1.75} />
                    </span>
                    <span className="font-mono text-sm font-semibold text-muted-foreground/50">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{step.text}</p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight className="absolute -right-3.5 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground/40 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── CAPACITÉS (bento) ───────────────────── */}
      <section className="border-b border-border py-14 sm:py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Plateforme complète"
            title="Tout ce dont une agence a besoin"
            subtitle="De la création à la facturation, une seule plateforme pour gérer tous vos clients."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                className={cn(
                  "rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
                  i === 0 && "sm:col-span-2 lg:col-span-1",
                )}
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-5">
                  <c.icon strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight text-foreground">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── TARIFS ───────────────────── */}
      <section id="tarifs" className="border-b border-border py-14 sm:py-20">
        <div className="container-marketing">
          <SectionHeading eyebrow="Tarifs" title="Une offre par maturité" subtitle="Commencez petit, passez à l'échelle quand vous êtes prêt." />
          <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PRICING.map((tier) => (
              <div key={tier.name} className={cn("relative flex flex-col rounded-2xl border bg-card p-7 shadow-sm", tier.highlight ? "border-brand/40 ring-2 ring-brand/15" : "border-border")}>
                {tier.highlight && (
                  <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-brand">Populaire</span>
                )}
                <h3 className="font-semibold tracking-tight text-foreground">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-display-md font-semibold tracking-tight text-foreground">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">{tier.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      <span className="text-foreground/90">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/register?plan=${tier.id}`} className={cn(buttonVariants({ variant: tier.highlight ? "brand" : "outline" }), "mt-7 w-full")}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── TÉMOIGNAGE ───────────────────── */}
      <section className="border-b border-border bg-card/40 py-14 sm:py-20">
        <div className="container-marketing max-w-3xl text-center">
          <p className="text-display-sm font-medium leading-snug tracking-tight text-foreground text-balance">
            « Depuis Callpme, nous ne ratons plus un seul appel. Nos agents
            prennent les rendez-vous et qualifient les leads, jour et nuit. »
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-white">AM</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Aline Mercier</p>
              <p className="text-xs text-muted-foreground">Fondatrice, Agence Vox</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── FAQ ───────────────────── */}
      <section id="faq" className="border-b border-border py-14 sm:py-20">
        <div className="container-marketing max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Questions fréquentes" subtitle="" />
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground">
                  {item.q}
                  <ChevronDown className="faq-chevron size-4 shrink-0 text-muted-foreground" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground text-pretty">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── CTA ───────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="container-marketing">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-14 text-center shadow-xl sm:px-16">
            <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: "radial-gradient(closest-side at 50% 0%, hsl(14 81% 54% / 0.30), transparent)" }} />
            <h2 className="relative text-display-md font-semibold tracking-tight text-white text-balance">Prêt à déployer votre premier agent ?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/65 text-pretty">Configurez un agent vocal complet en quelques minutes. Aucune carte bancaire requise pour commencer.</p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={cn(buttonVariants({ variant: "brand", size: "lg" }), "gap-1.5")}>
                Créer mon compte
                <ArrowRight className="size-4" />
              </Link>
              <a href="#developpeurs" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                <Code2 className="size-4" /> Explorer l'API
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-display-md font-semibold tracking-tight text-foreground text-balance">{title}</h2>
      {subtitle && <p className="mt-3 text-lg text-muted-foreground text-pretty">{subtitle}</p>}
    </div>
  );
}

/** Soulignement signature sous un mot, façon trait dessiné. */
function Underline() {
  return (
    <svg className="absolute -bottom-1.5 left-0 h-2.5 w-full text-brand/40" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
      <path d="M1 5.5C20 2 45 1.5 99 4" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Fenêtre de terminal (chrome sombre + pastilles + onde). */
function TerminalWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-[hsl(24_10%_20%)] bg-[hsl(24_14%_9%)] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate font-mono text-xs text-white/40">{title}</span>
        <Waveform tone="light" className="ml-auto" />
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

/** Onde sonore signature (statique, animée en opacité). */
function Waveform({ tone = "brand", className }: { tone?: "brand" | "light"; className?: string }) {
  const bars = [6, 11, 16, 9, 18, 13, 7, 15, 20, 12, 8, 14, 10];
  return (
    <div className={cn("flex items-center gap-[3px]", className)} aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] animate-pulse rounded-full", tone === "light" ? "bg-brand/70" : "bg-brand/60")}
          style={{ height: `${h}px`, animationDelay: `${i * 90}ms`, animationDuration: "1.4s" }}
        />
      ))}
    </div>
  );
}

/** Maquette du tableau de bord (visuel produit, HTML/SVG, on-brand). */
function DashboardMockup() {
  const bars = [38, 52, 30, 64, 46, 72, 58, 80, 50, 68, 42, 60];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">app.callpme.com/overview</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr]">
        <div className="hidden flex-col gap-1 border-r border-border p-3 sm:flex">
          {[["Bot", "Agents", true], ["PhoneIncoming", "Appels", false], ["Megaphone", "Campagnes", false], ["BarChart3", "Statistiques", false], ["AudioLines", "Studio", false]].map(([icon, label, active]) => (
            <span key={label as string} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs", active ? "bg-brand-50 font-medium text-brand-700" : "text-muted-foreground")}>
              <span className="[&_svg]:size-3.5"><DynamicIcon name={icon as string} /></span>
              {label as string}
            </span>
          ))}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[["Appels", "1 284"], ["Résolus", "78%"], ["Durée moy.", "2:48"]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border bg-secondary/30 p-2.5">
                <p className="text-[0.65rem] text-muted-foreground">{l}</p>
                <p className="tabular mt-0.5 text-sm font-semibold text-foreground">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Appels · 14 jours</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-700">+12%</span>
            </div>
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {bars.map((h, i) => (
                <span key={i} className={cn("flex-1 rounded-t-sm", i === bars.length - 2 ? "bg-brand" : "bg-brand/25")} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
