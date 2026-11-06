import { LayoutGrid, Phone, Bot, ChartNoAxesColumn, Settings, Megaphone } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Aperçu illustratif du tableau de bord (données d'exemple, aucune donnée
 * réelle). Construit en HTML/CSS pour rester net à toute résolution et léger.
 * Tout le bloc est décoratif pour les lecteurs d'écran, avec un résumé texte.
 */
const NAV = [
  { icon: LayoutGrid, label: "Vue d'ensemble", active: true },
  { icon: Bot, label: "Agents" },
  { icon: Phone, label: "Appels" },
  { icon: Megaphone, label: "Campagnes" },
  { icon: ChartNoAxesColumn, label: "Analyses" },
  { icon: Settings, label: "Réglages" },
];

const KPIS = [
  { label: "Appels traités", value: "1 284", delta: "+18 %" },
  { label: "Résolus sans humain", value: "87 %", delta: "+4 pts" },
  { label: "Rendez-vous pris", value: "312", delta: "+26 %" },
  { label: "Temps de réponse", value: "0,6 s", delta: "−0,1 s" },
];

const BARS = [38, 52, 44, 61, 58, 72, 66, 80, 74, 91, 85, 97, 88, 76];

const CALLS = [
  { who: "+33 6 •• •• 21", agent: "Standard", outcome: "Rendez-vous", time: "09:42" },
  { who: "+225 05 •• •• 70", agent: "Support", outcome: "Résolu", time: "09:31" },
  { who: "+221 77 •• •• 03", agent: "Qualification", outcome: "Lead chaud", time: "09:18" },
  { who: "+32 4 •• •• 56", agent: "Standard", outcome: "Transféré", time: "09:05" },
];

export function DashboardPreview() {
  return (
    <figure className="bezel">
      <figcaption className="sr-only">
        Aperçu du tableau de bord Callpme avec des données d'exemple : 1 284 appels traités, 87 % résolus sans
        intervention humaine, 312 rendez-vous pris.
      </figcaption>
      <div aria-hidden className="bezel-core overflow-hidden">
        {/* Barre de fenêtre */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="mono ml-4 rounded-md bg-foreground/[0.05] px-3 py-1 text-[11px] text-muted-foreground">app.callpme.com/overview</span>
        </div>

        <div className="grid md:grid-cols-[200px_1fr]">
          <aside className="hidden border-r border-border p-4 md:block">
            <div className="flex items-center gap-2 px-2 pb-5">
              <LogoMark size={20} />
              <span className="text-sm font-semibold text-foreground">Callpme</span>
            </div>
            <ul className="space-y-1">
              {NAV.map((n) => (
                <li
                  key={n.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                    n.active ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground",
                  )}
                >
                  <n.icon className="size-4" strokeWidth={1.5} />
                  {n.label}
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cette semaine</p>
                <p className="text-lg font-semibold tracking-tight text-foreground">Bonjour, Aminata</p>
              </div>
              <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-foreground">
                <span className="size-1.5 rounded-full bg-success" /> 3 agents en ligne
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-background/50 p-3.5">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground tabular">{k.value}</p>
                  <p className="mt-0.5 text-[11px] text-success">{k.delta}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Appels par jour</p>
                <div className="mt-4 flex h-32 items-end gap-1.5">
                  {BARS.map((h, i) => (
                    <span
                      key={i}
                      className={cn("flex-1 rounded-t-[3px]", i === BARS.length - 3 ? "bg-brand" : "bg-foreground/15")}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">Derniers appels</p>
                <ul className="mt-3 space-y-2.5">
                  {CALLS.map((c) => (
                    <li key={c.who} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0">
                        <span className="mono block truncate text-foreground">{c.who}</span>
                        <span className="text-muted-foreground">{c.agent}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-foreground">{c.outcome}</span>
                        <span className="mono text-muted-foreground">{c.time}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
