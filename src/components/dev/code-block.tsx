"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-inner-top",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-foreground/[0.02] px-3 py-1.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Code copié" : `Copier le code${language ? ` ${language}` : ""}`}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600" aria-hidden="true" /> Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden="true" /> Copier
            </>
          )}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Code copié dans le presse-papiers" : ""}
        </span>
      </div>
      <pre
        tabIndex={0}
        className="overflow-x-auto px-4 py-3.5 font-mono text-[0.78rem] leading-relaxed text-foreground/90"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function CodeTabs({
  samples,
}: {
  samples: { label: string; language: string; code: string }[];
}) {
  const [active, setActive] = useState(0);
  const current = samples[active];
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-1" role="group" aria-label="Langage">
        {samples.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              i === active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} language={current.language} />
    </div>
  );
}
