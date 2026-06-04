"use client";

import { useState } from "react";
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
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("keys");

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tab === "keys" && <ApiKeysPanel initialKeys={apiKeys} />}
        {tab === "functions" && <FunctionsPanel initialFunctions={functions} />}
        {tab === "webhooks" && <WebhooksPanel initialWebhooks={webhooks} />}
        {tab === "docs" && <DocsPanel apiBaseUrl={apiBaseUrl} />}
      </div>
    </div>
  );
}
