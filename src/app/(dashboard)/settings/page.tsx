import Link from "next/link";
import { Building2, Users, Plug, KeyRound, User, Lock } from "lucide-react";
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

const INTEGRATIONS = [
  { name: "Twilio", category: "Téléphonie", env: "TWILIO_ACCOUNT_SID" },
  { name: "OpenAI", category: "LLM", env: "OPENAI_API_KEY" },
  { name: "Anthropic", category: "LLM", env: "ANTHROPIC_API_KEY" },
  { name: "Mistral AI", category: "LLM", env: "MISTRAL_API_KEY" },
  { name: "Deepgram", category: "Transcription (STT)", env: "DEEPGRAM_API_KEY" },
  { name: "ElevenLabs", category: "Synthèse vocale (TTS)", env: "ELEVENLABS_API_KEY" },
];

function roleBadge(role: string) {
  if (role === "owner") return <Badge variant="brand">Propriétaire</Badge>;
  if (role === "admin") return <Badge variant="default">Admin</Badge>;
  return <Badge variant="muted">Membre</Badge>;
}

export default async function SettingsPage() {
  const session = await requireSession();
  const org = session.org;

  const users = await prisma.user.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réglages"
        description="Organisation, profil, sécurité, équipe et intégrations."
        breadcrumb={[{ label: "Réglages" }]}
      />

      {/* Organisation */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <Building2 className="size-4 text-muted-foreground" />
          Organisation
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrganizationForm name={org.name} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Offre</p>
            <Link
              href="/billing"
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 transition-colors hover:bg-accent"
            >
              <Badge variant="brand">{getPlan(org.plan).name}</Badge>
              <span className="text-sm text-muted-foreground">
                {getPlan(org.plan).tagline}
              </span>
            </Link>
          </div>
        </div>
      </Card>

      {/* Profil */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <User className="size-4 text-muted-foreground" />
          Profil
        </h2>
        <div className="mt-4">
          <ProfileForm name={session.user.name ?? ""} email={session.user.email} />
        </div>
      </Card>

      {/* Sécurité */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <Lock className="size-4 text-muted-foreground" />
          Sécurité — mot de passe
        </h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      {/* Équipe */}
      <Card>
        <div className="flex items-center gap-2 p-5 pb-3">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Équipe</h2>
          <span className="ml-auto text-sm text-muted-foreground">
            {users.length} membre{users.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/70 ring-1 ring-inset ring-border">
                {initials(u.name ?? u.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {u.name ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                </p>
              </div>
              {roleBadge(u.role)}
            </div>
          ))}
        </div>
      </Card>

      {/* Intégrations */}
      <Card>
        <div className="flex items-center gap-2 p-5 pb-3">
          <Plug className="size-4 text-muted-foreground" />
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            Intégrations
          </h2>
          <Link
            href="/integrations"
            className="ml-auto text-sm font-medium text-brand hover:underline"
          >
            Gérer
          </Link>
        </div>
        <div className="divide-y divide-border">
          {INTEGRATIONS.map((integ) => {
            const configured = Boolean(process.env[integ.env]);
            return (
              <div key={integ.name} className="flex items-center gap-3 px-5 py-3.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border">
                  <KeyRound className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {integ.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {integ.category}
                  </p>
                </div>
                {configured ? (
                  <Badge variant="success">Connecté</Badge>
                ) : (
                  <Badge variant="muted">À configurer</Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
