import Link from "next/link";
import {
  Building2,
  Users,
  KeyRound,
  User,
  Lock,
  Server,
  ArrowRight,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OrganizationForm,
  ProfileForm,
  PasswordForm,
} from "@/components/settings/settings-forms";
import { initials } from "@/lib/utils";

export const metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

/** Platform services configured server-side via environment variables. */
const PLATFORM_SERVICES = [
  { name: "Twilio", category: "Téléphonie", env: "TWILIO_ACCOUNT_SID" },
  { name: "OpenAI", category: "LLM", env: "OPENAI_API_KEY" },
  { name: "Anthropic", category: "LLM", env: "ANTHROPIC_API_KEY" },
  { name: "Mistral AI", category: "LLM", env: "MISTRAL_API_KEY" },
  { name: "Deepgram", category: "Transcription (STT)", env: "DEEPGRAM_API_KEY" },
  { name: "ElevenLabs", category: "Synthèse vocale (TTS)", env: "ELEVENLABS_API_KEY" },
];

const SECTIONS = [
  { id: "profil", label: "Profil", icon: User },
  { id: "organisation", label: "Organisation", icon: Building2 },
  { id: "equipe", label: "Équipe", icon: Users },
  { id: "securite", label: "Sécurité", icon: Lock },
  { id: "services", label: "Services", icon: Server },
] as const;

function roleBadge(role: string) {
  if (role === "owner") return <Badge variant="brand">Propriétaire</Badge>;
  if (role === "admin") return <Badge variant="default">Admin</Badge>;
  return <Badge variant="muted">Membre</Badge>;
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  icon: typeof User;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2
        id={`${id}-title`}
        className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-foreground"
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();
  const org = session.org;
  const plan = getPlan(org.plan);

  const users = await prisma.user.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réglages"
        description="Profil, organisation, équipe et sécurité de votre compte."
        breadcrumb={[{ label: "Réglages" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* In-page navigation */}
        <nav aria-label="Sections des réglages" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <s.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* Profil */}
          <Card
            id="profil"
            role="region"
            aria-labelledby="profil-title"
            className="scroll-mt-6 p-5 sm:p-6"
          >
            <SectionHeading
              id="profil"
              icon={User}
              title="Profil"
              description="Votre nom et l'e-mail utilisé pour vous connecter."
            />
            <div className="mt-5">
              <ProfileForm name={session.user.name ?? ""} email={session.user.email} />
            </div>
          </Card>

          {/* Organisation */}
          <Card
            id="organisation"
            role="region"
            aria-labelledby="organisation-title"
            className="scroll-mt-6 p-5 sm:p-6"
          >
            <SectionHeading
              id="organisation"
              icon={Building2}
              title="Organisation"
              description="Le nom affiché dans votre espace et vos e-mails."
            />
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
              <OrganizationForm name={org.name} />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground/90">Offre</p>
                <Link
                  href="/billing"
                  className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <Badge variant="brand">{plan.name}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {plan.tagline}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Gérer la facturation</span>
                </Link>
              </div>
            </div>
          </Card>

          {/* Équipe */}
          <Card
            id="equipe"
            role="region"
            aria-labelledby="equipe-title"
            className="scroll-mt-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3 sm:px-6">
              <SectionHeading
                id="equipe"
                icon={Users}
                title="Équipe"
                description="Les personnes qui ont accès à cette organisation."
              />
              <span className="text-sm text-muted-foreground">
                {users.length} membre{users.length > 1 ? "s" : ""}
              </span>
            </div>
            <ul className="divide-y divide-border border-t border-border">
              {users.map((u) => {
                const isMe = u.id === session.user.id;
                return (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/75 ring-1 ring-inset ring-border"
                    >
                      {initials(u.name ?? u.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.name ?? "Sans nom"}
                        {isMe && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (vous)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {roleBadge(u.role)}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Sécurité */}
          <Card
            id="securite"
            role="region"
            aria-labelledby="securite-title"
            className="scroll-mt-6 p-5 sm:p-6"
          >
            <SectionHeading
              id="securite"
              icon={Lock}
              title="Sécurité"
              description="Changez votre mot de passe. Un e-mail de confirmation vous est envoyé."
            />
            <div className="mt-5 max-w-2xl">
              <PasswordForm />
            </div>
          </Card>

          {/* Services de la plateforme (env, côté serveur) */}
          <Card
            id="services"
            role="region"
            aria-labelledby="services-title"
            className="scroll-mt-6"
          >
            <div className="p-5 pb-3 sm:px-6">
              <SectionHeading
                id="services"
                icon={Server}
                title="Services de la plateforme"
                description="Clés définies côté serveur (variables d'environnement) par l'administrateur de l'instance. Elles ne se modifient pas ici."
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Pour vos propres outils (agenda, CRM…), voir{" "}
                <Link
                  href="/integrations"
                  className="rounded font-medium text-brand-400 underline-offset-2 hover:underline"
                >
                  Intégrations
                </Link>
                .
              </p>
            </div>
            <ul className="divide-y divide-border border-t border-border">
              {PLATFORM_SERVICES.map((svc) => {
                const configured = Boolean(process.env[svc.env]);
                return (
                  <li key={svc.name} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border"
                    >
                      <KeyRound className="size-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.category}</p>
                    </div>
                    {configured ? (
                      <Badge variant="success">Clé configurée</Badge>
                    ) : (
                      <Badge variant="muted">Non configurée</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
