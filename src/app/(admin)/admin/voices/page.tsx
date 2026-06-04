import { AudioLines } from "lucide-react";
import { listAllVoicesAdmin } from "@/lib/db/admin";
import {
  PRESET_VOICES,
  presetsByCategory,
  GENDER_LABELS,
} from "@/lib/voices/catalog";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminVoices } from "@/components/admin/admin-voices";

export const metadata = { title: "Voix" };
export const dynamic = "force-dynamic";

export default async function AdminVoicesPage() {
  const voices = await listAllVoicesAdmin();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voix de la plateforme"
        description="Le catalogue intégré et toutes les voix créées (Studio + par ID)."
      />

      {/* Catalogue intégré (toujours disponible) */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-5 py-3">
          <AudioLines className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Catalogue intégré · {PRESET_VOICES.length} voix
          </h2>
          <Badge variant="muted" className="ml-auto">
            Toujours disponible
          </Badge>
        </div>
        <div className="divide-y divide-border">
          {presetsByCategory().map((group) => (
            <div key={group.category} className="px-5 py-3">
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.category}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.voices.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs"
                    title={v.description}
                  >
                    <span className="font-medium text-foreground">{v.label}</span>
                    <span className="text-muted-foreground/70">
                      {GENDER_LABELS[v.gender]} · {v.language}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Voix créées (Studio + par ID) — gérables */}
      <AdminVoices
        initial={voices.map((v) => ({
          id: v.id,
          name: v.name,
          provider: v.provider,
          status: v.status,
          gender: v.gender,
          accent: v.accent,
          orgName: v.orgName,
        }))}
      />
    </div>
  );
}
