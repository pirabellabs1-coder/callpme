"use client";

import { useRef, useState } from "react";
import { KeyRound, Webhook, BookText, FunctionSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiKeysPanel, type ApiKeyView } from "./api-keys-panel";
import { WebhooksPanel, type WebhookView } from "./webhooks-panel";
import { FunctionsPanel, type FunctionView } from "./functions-panel";
import { DocsPanel } from "./docs-panel";

const TABS = [
  { id: "keys", label: "Clés API", icon: KeyRound },
  { id: "functions", label: "Fonctions", icon: FunctionSquare },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "docs", label: "Documentation", icon: BookText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DeveloperTabs({
  apiKeys,
  webhooks,
  functions,
  apiBaseUrl,
}: {
  apiKeys: ApiKeyView[];
  webhooks: WebhookView[];
  functions: FunctionView[];
  apiBaseUrl: string;
}) {
  const [tab, setTab] = useState<TabId>("keys");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = TABS[next].id;
    setTab(id);
    refs.current[id]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections développeurs"
        className="flex items-center gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`dev-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`dev-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Panels stay mounted so client-side state (new keys, webhooks…) survives tab switches. */}
      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`dev-panel-${t.id}`}
          aria-labelledby={`dev-tab-${t.id}`}
          hidden={tab !== t.id}
          className="pt-6"
        >
          {t.id === "keys" && <ApiKeysPanel initialKeys={apiKeys} />}
          {t.id === "functions" && <FunctionsPanel initialFunctions={functions} />}
          {t.id === "webhooks" && <WebhooksPanel initialWebhooks={webhooks} />}
          {t.id === "docs" && <DocsPanel apiBaseUrl={apiBaseUrl} />}
        </div>
      ))}
    </div>
  );
}
