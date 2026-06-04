"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, Check, PhoneCall, Megaphone, Info, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, typeof Info> = {
  call: PhoneCall,
  campaign: Megaphone,
  system: Settings2,
  info: Info,
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications);
        setUnread(data.unread);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead() {
    setUnread(0);
    setItems((i) => i.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read", { method: "POST" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) markRead();
        }}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-[1.15rem]" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute right-2 top-2 inline-flex min-w-3.5 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-semibold text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {items.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={markRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-700"
                >
                  <Check className="size-3.5" /> Tout lire
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification.
                </p>
              ) : (
                items.map((n) => {
                  const Icon = ICONS[n.type] ?? Info;
                  const content = (
                    <div
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40",
                        !n.read && "bg-brand-50/30",
                      )}
                    >
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        {n.body && (
                          <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                  return n.href ? (
                    <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
