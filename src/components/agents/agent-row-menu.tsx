"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  Loader2,
  MoreVertical,
  Pause,
  PlayCircle,
  Play,
  Trash2,
} from "lucide-react";
import type { Agent, AgentStatus } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type Action = "duplicate" | "toggle" | "delete";

/**
 * Menu « … » d'une ligne d'agent : Voir, Dupliquer, Mettre en pause / en
 * ligne, Supprimer. Toutes les actions s'appuient sur l'API existante
 * (POST /api/agents, PATCH et DELETE /api/agents/:id).
 */
export function AgentRowMenu({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const nextStatus: AgentStatus =
    agent.status === "active" ? "paused" : "active";

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus sur le premier élément à l'ouverture.
  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  function items(): HTMLElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      ) ?? [],
    );
  }

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  async function run(action: Action) {
    setError(null);
    if (action === "delete") {
      const okDelete = window.confirm(
        `Supprimer définitivement « ${agent.name} » et tous ses appels ? Cette action est irréversible.`,
      );
      if (!okDelete) return close();
    }
    setOpen(false);
    setPending(action);
    try {
      let res: Response;
      if (action === "duplicate") {
        const suffix = " (copie)";
        res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agent.name.slice(0, 80 - suffix.length) + suffix,
            role: agent.role,
            // Une copie n'est jamais mise en ligne d'office, et sans numéro.
            status: "draft",
            config: agent.config,
            phoneNumber: null,
            clientId: agent.clientId,
            knowledgeBaseId: agent.knowledgeBaseId,
          }),
        });
      } else if (action === "toggle") {
        res = await fetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      } else {
        res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "L'action a échoué.");
        return;
      }
      if (action === "duplicate" && data.agent?.id) {
        router.push(`/agents/${data.agent.id}/edit`);
      }
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Plus d'actions pour ${agent.name}`}
        disabled={pending !== null}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <MoreVertical className="size-4" aria-hidden />
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions pour ${agent.name}`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/40 animate-scale-in"
        >
          <MenuItem
            icon={Eye}
            onSelect={() => {
              setOpen(false);
              router.push(`/agents/${agent.id}`);
            }}
          >
            Voir le détail
          </MenuItem>
          <MenuItem
            icon={PlayCircle}
            onSelect={() => {
              setOpen(false);
              router.push(`/agents/${agent.id}/test`);
            }}
          >
            Tester l&apos;agent
          </MenuItem>
          <MenuItem icon={Copy} onSelect={() => run("duplicate")}>
            Dupliquer
          </MenuItem>
          <MenuItem
            icon={nextStatus === "paused" ? Pause : Play}
            onSelect={() => run("toggle")}
          >
            {nextStatus === "paused" ? "Mettre en pause" : "Mettre en ligne"}
          </MenuItem>
          <div role="separator" className="my-1 h-px bg-border" />
          <MenuItem icon={Trash2} destructive onSelect={() => run("delete")}>
            Supprimer
          </MenuItem>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-destructive/30 bg-popover px-2.5 py-1.5 text-xs text-destructive shadow-lg shadow-black/40"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-1.5 underline underline-offset-2"
          >
            OK
          </button>
        </p>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onSelect,
  destructive,
}: {
  icon: typeof Copy;
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus:outline-none",
        destructive
          ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
          : "text-foreground/90 hover:bg-accent focus:bg-accent",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </button>
  );
}
