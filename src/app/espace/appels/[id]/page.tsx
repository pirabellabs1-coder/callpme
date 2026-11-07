import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientSession } from "@/lib/auth/session";
import { clientCall } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/shared/types";

export const metadata = { title: "Appel" };
export const dynamic = "force-dynamic";

export default async function PortalCall({ params }: { params: { id: string } }) {
  const s = await requireClientSession();
  const call = await clientCall(s, params.id);
  if (!call) notFound();
  let turns: TranscriptTurn[] = [];
  try {
    turns = JSON.parse(call.transcript) as TranscriptTurn[];
  } catch {
    turns = [];
  }
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return (
    <div className="space-y-4">
      <Link href="/espace/appels" className="text-sm text-muted-foreground hover:underline">
        ← Tous les appels
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{call.outcome ?? "Appel"}</h1>
        <p className="text-sm text-muted-foreground">
          {time.format(call.createdAt)} · {call.agent.name} · {Math.round(call.durationSec / 60)} min
        </p>
      </div>
      {call.summary && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Résumé</h2>
          <p className="mt-1 text-sm">{call.summary}</p>
        </Card>
      )}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Conversation</h2>
        <ol className="space-y-2">
          {turns
            .filter((t) => t.speaker !== "tool" && t.speaker !== "system")
            .map((t, i) => (
              <li key={i} className={cn("flex", t.speaker === "agent" ? "justify-start" : "justify-end")}>
                <p
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    t.speaker === "agent" ? "bg-secondary" : "bg-brand text-brand-foreground",
                  )}
                >
                  <span className="sr-only">{t.speaker === "agent" ? "Assistant : " : "Appelant : "}</span>
                  {t.text}
                </p>
              </li>
            ))}
        </ol>
      </Card>
    </div>
  );
}
