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
        "relative min-w-0 overflow-hidden rounded-lg border border-[hsl(24_10%_22%)] bg-[hsl(24_14%_9%)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-white/40">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-400" /> Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copier
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[0.78rem] leading-relaxed text-white/90">
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
      <div className="mb-2 flex items-center gap-1">
        {samples.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setActive(i)}
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
