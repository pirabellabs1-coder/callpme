import Link from "next/link";
import { MessageCircle, Mic } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoredMessage } from "@/lib/whatsapp/handler";

export const metadata = { title: "Conversations" };
export const dynamic = "force-dynamic";

function parse(raw: string): StoredMessage[] {
  try {
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

export default async function ConversationsPage({ searchParams }: { searchParams: { c?: string } }) {
  const session = await requireSession();
  const conversations = await prisma.conversation.findMany({
    where: { organizationId: session.org.id },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: { id: true, contact: true, contactName: true, lastText: true, lastMessageAt: true },
  });
  const selected = conversations.find((c) => c.id === searchParams.c) ?? conversations[0] ?? null;
  // Historique chargé pour la seule conversation affichée (toujours limité à l'organisation).
  const full = selected
    ? await prisma.conversation.findFirst({ where: { id: selected.id, organizationId: session.org.id }, select: { messages: true } })
    : null;
  const messages = full ? parse(full.messages) : [];
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description="Les échanges écrits de vos agents (WhatsApp)."
        breadcrumb={[{ label: "Conversations" }]}
      />
      {conversations.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <MessageCircle className="size-10 text-emerald-500" aria-hidden />
          <p className="font-medium">Aucune conversation pour l&apos;instant</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Connectez votre numéro WhatsApp Business : chaque message reçu et chaque réponse de l&apos;agent apparaîtront ici.
          </p>
          <Link href="/channels" className={buttonVariants({ variant: "brand", size: "sm" })}>
            Connecter WhatsApp
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav aria-label="Conversations">
            <ul className="space-y-1">
              {conversations.map((c) => {
                const active = c.id === selected?.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/conversations?c=${c.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-xl border px-3 py-2.5 transition-colors",
                        active ? "border-brand/50 bg-brand-50" : "border-transparent hover:bg-accent",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.contactName || c.contact}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{time.format(c.lastMessageAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.lastText ?? ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {selected && (
            <Card className="flex min-h-[420px] flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="font-medium">{selected.contactName || selected.contact}</p>
                  <p className="mono text-xs text-muted-foreground">{selected.contact}</p>
                </div>
                <Badge variant="success">WhatsApp</Badge>
              </div>
              <ol className="flex-1 space-y-2 overflow-y-auto p-4" aria-label="Messages">
                {messages.map((m, i) =>
                  m.role === "tool" ? (
                    <li key={i} className="text-center text-xs text-muted-foreground">
                      {m.text}
                    </li>
                  ) : (
                    <li key={i} className={cn("flex", m.role === "agent" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          m.role === "agent" ? "bg-brand text-brand-foreground" : "bg-secondary text-foreground",
                        )}
                      >
                        {m.kind === "voice" && (
                          <span className="mb-0.5 flex items-center gap-1 text-xs opacity-80">
                            <Mic className="size-3" aria-hidden /> Note vocale (transcrite)
                          </span>
                        )}
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <p className="mt-0.5 text-right text-[0.65rem] opacity-70">{time.format(new Date(m.at))}</p>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
