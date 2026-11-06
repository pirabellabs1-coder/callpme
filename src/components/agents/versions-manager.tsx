"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FlaskConical, History, Loader2, RotateCcw } from "lucide-react";
import { restoreVersion, startAbTest, stopAbTest } from "@/app/actions/agent-versions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface AbStats {
  variant: "A" | "B";
  calls: number;
  avgDurationSec: number | null;
  avgScore: number | null;
  goalRate: number | null;
  transferRate: number | null;
}

interface VersionView {
  id: string;
  number: number;
  note: string | null;
  createdAt: string;
}

const dash = (v: number | null, unit = "") => (v === null ? "—" : `${v}${unit}`);

export function VersionsManager({
  agentId,
  versions,
  ab,
  stats,
}: {
  agentId: string;
  versions: VersionView[];
  ab: { versionId: string; share: number; startedAt: string } | null;
  stats: AbStats[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [testVersion, setTestVersion] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [share, setShare] = useState(20);
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  const current = versions[0];
  const testing = ab ? versions.find((v) => v.id === ab.versionId) : null;

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Test A/B */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-brand" aria-hidden />
          <h3 className="text-sm font-semibold">Test A/B</h3>
          {ab && <Badge variant="brand">En cours</Badge>}
        </div>
        {ab && stats ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {ab.share} % des appels utilisent la version {testing?.number ?? "?"} (B), les autres la version actuelle (A), depuis le{" "}
              {date.format(new Date(ab.startedAt))}. Tests du navigateur exclus.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Résultats du test A/B</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 font-medium">Variante</th>
                    <th scope="col" className="py-2 text-right font-medium">Appels</th>
                    <th scope="col" className="py-2 text-right font-medium">Score moyen</th>
                    <th scope="col" className="py-2 text-right font-medium">Objectif atteint</th>
                    <th scope="col" className="py-2 text-right font-medium">Transferts</th>
                    <th scope="col" className="py-2 text-right font-medium">Durée moyenne</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {stats.map((s) => (
                    <tr key={s.variant} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 text-left font-medium">
                        {s.variant === "A" ? "A · actuelle" : `B · version ${testing?.number ?? "?"}`}
                      </th>
                      <td className="py-2 text-right">{s.calls}</td>
                      <td className="py-2 text-right">{dash(s.avgScore, " / 100")}</td>
                      <td className="py-2 text-right">{dash(s.goalRate, " %")}</td>
                      <td className="py-2 text-right">{dash(s.transferRate, " %")}</td>
                      <td className="py-2 text-right">{s.avgDurationSec === null ? "—" : `${Math.round(s.avgDurationSec / 60)} min`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.some((s) => s.calls < 30) && (
              <p className="text-xs text-muted-foreground">Attendez au moins une trentaine d&apos;appels par variante avant de conclure.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="brand" size="sm" disabled={pending} onClick={() => run(() => stopAbTest(agentId, true))}>
                {pending && <Loader2 className="animate-spin" aria-hidden />} Adopter la variante B
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => stopAbTest(agentId, false))}>
                Garder la version actuelle
              </Button>
            </div>
          </div>
        ) : versions.length < 2 ? (
          <p className="text-sm text-muted-foreground">Modifiez l&apos;agent au moins une fois pour pouvoir comparer deux versions.</p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => startAbTest(agentId, testVersion, share));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ab-version">Version à tester (B)</Label>
              <Select id="ab-version" value={testVersion} onChange={(e) => setTestVersion(e.target.value)}>
                {versions
                  .filter((v) => v.id !== current?.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.number} · {date.format(new Date(v.createdAt))}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab-share">Part des appels</Label>
              <Select id="ab-share" value={String(share)} onChange={(e) => setShare(Number(e.target.value))}>
                {[10, 20, 30, 50].map((v) => (
                  <option key={v} value={v}>
                    {v} %
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Lancer le test
            </Button>
          </form>
        )}
      </Card>

      {/* Historique */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Historique</h3>
        </div>
        <ol className="divide-y divide-border">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-24 shrink-0 font-medium">Version {v.number}</span>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                {v.note ?? "—"} · {date.format(new Date(v.createdAt))}
              </span>
              {i === 0 ? (
                <Badge variant="success">Actuelle</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Revenir à la version ${v.number} ? Les consignes, la voix, le parcours et les outils de cette version seront rétablis.`)) {
                      run(() => restoreVersion(agentId, v.id));
                    }
                  }}
                >
                  <RotateCcw aria-hidden /> Restaurer
                </Button>
              )}
            </li>
          ))}
        </ol>
      </Card>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
