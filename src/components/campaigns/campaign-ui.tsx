/** Petites briques d'UI partagées par la liste et le détail des campagnes. */
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Variant = "muted" | "brand" | "warning" | "success";

export const CAMPAIGN_STATUS: Record<string, { label: string; variant: Variant; dot: string }> = {
  draft: { label: "Brouillon", variant: "muted", dot: "bg-muted-foreground/60" },
  running: { label: "En cours", variant: "brand", dot: "bg-brand animate-pulse motion-reduce:animate-none" },
  paused: { label: "En pause", variant: "warning", dot: "bg-amber-500" },
  completed: { label: "Terminée", variant: "success", dot: "bg-emerald-500" },
};

export function CampaignStatusBadge({ status }: { status: string }) {
  const st = CAMPAIGN_STATUS[status] ?? CAMPAIGN_STATUS.draft;
  return (
    <Badge variant={st.variant}>
      <span className={cn("size-1.5 rounded-full", st.dot)} aria-hidden />
      {st.label}
    </Badge>
  );
}

/** Statut d'un contact : libellé + teinte (le libellé porte le sens, pas la couleur). */
export const CONTACT_STATUS: Record<string, { label: string; text: string; bar: string }> = {
  pending: { label: "En attente", text: "text-muted-foreground", bar: "bg-muted-foreground/30" },
  calling: { label: "Appel en cours", text: "text-brand", bar: "bg-brand" },
  completed: { label: "Joint", text: "text-emerald-600", bar: "bg-emerald-500" },
  no_answer: { label: "Sans réponse", text: "text-amber-600", bar: "bg-amber-500" },
  failed: { label: "Échec", text: "text-rose-600", bar: "bg-rose-500" },
  opted_out: { label: "Opposition", text: "text-rose-600", bar: "bg-rose-400" },
};

export const CONTACT_STATUS_ORDER = [
  "completed",
  "no_answer",
  "calling",
  "failed",
  "opted_out",
  "pending",
] as const;

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className="h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${v / 100})` }}
      />
    </div>
  );
}
