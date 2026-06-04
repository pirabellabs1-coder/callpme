"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Bot,
  PhoneCall,
  Building2,
  Plus,
  Megaphone,
  AudioLines,
  CornerDownLeft,
} from "lucide-react";
import type { AgentRole } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { RoleIcon } from "@/components/role-badge";

interface Results {
  agents: { id: string; name: string; role: AgentRole }[];
  clients: { id: string; name: string }[];
  calls: { id: string; outcome: string | null; fromNumber: string }[];
}

const ACTIONS = [
  { label: "Créer un agent", href: "/agents/new", icon: Plus },
  { label: "Nouvelle campagne", href: "/campaigns", icon: Megaphone },
  { label: "Studio Voix", href: "/voices", icon: AudioLines },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>({ agents: [], clients: [], calls: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setRes({ agents: [], clients: [], calls: [] });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (r.ok) setRes(await r.json());
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const hasResults =
    res.agents.length + res.clients.length + res.calls.length > 0;

  return (
    <>
      {/* Déclencheur (façon barre de recherche) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 max-w-sm flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-brand/40 sm:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="mono rounded border border-border bg-secondary px-1.5 py-0.5 text-[0.65rem]">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
        aria-label="Rechercher"
      >
        <Search className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-fade-in"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-xl animate-scale-in">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher agents, appels, clients…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {!q && (
                <Group title="Actions">
                  {ACTIONS.map((a) => (
                    <Item key={a.href} onClick={() => go(a.href)} icon={<a.icon className="size-4" />}>
                      {a.label}
                    </Item>
                  ))}
                </Group>
              )}
              {q && !hasResults && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Aucun résultat pour « {q} ».
                </p>
              )}
              {res.agents.length > 0 && (
                <Group title="Agents">
                  {res.agents.map((a) => (
                    <Item
                      key={a.id}
                      onClick={() => go(`/agents/${a.id}`)}
                      icon={<RoleIcon role={a.role} size="sm" />}
                    >
                      {a.name}
                    </Item>
                  ))}
                </Group>
              )}
              {res.clients.length > 0 && (
                <Group title="Clients">
                  {res.clients.map((c) => (
                    <Item key={c.id} onClick={() => go("/clients")} icon={<Building2 className="size-4" />}>
                      {c.name}
                    </Item>
                  ))}
                </Group>
              )}
              {res.calls.length > 0 && (
                <Group title="Appels">
                  {res.calls.map((c) => (
                    <Item
                      key={c.id}
                      onClick={() => go(`/calls/${c.id}`)}
                      icon={<PhoneCall className="size-4" />}
                    >
                      {c.outcome ?? "Appel"} · {c.fromNumber}
                    </Item>
                  ))}
                </Group>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function Item({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <CornerDownLeft className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground" />
    </button>
  );
}
