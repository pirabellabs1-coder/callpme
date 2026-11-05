"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactResult } from "@/app/actions/contact";

/**
 * Formulaire public accessible (contact, partenariat) :
 * libellés réels, erreurs reliées aux champs (aria-describedby/aria-invalid),
 * focus sur le premier champ en erreur, état d'envoi et confirmation.
 * La validation qui fait foi est côté serveur.
 */
export type Field =
  | { name: string; label: string; type?: "text" | "email" | "url"; required?: boolean; autoComplete?: string; placeholder?: string; half?: boolean }
  | { name: string; label: string; type: "textarea"; required?: boolean; placeholder?: string; half?: boolean }
  | { name: string; label: string; type: "select"; required?: boolean; options: { value: string; label: string }[]; half?: boolean };

export function LeadForm({
  fields,
  action,
  submitLabel,
  successTitle,
  successBody,
}: {
  fields: Field[];
  action: (fd: FormData) => Promise<ContactResult>;
  submitLabel: string;
  successTitle: string;
  successBody: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ContactResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(fd);
      setResult(r);
      if (r.fieldErrors) {
        const first = Object.keys(r.fieldErrors)[0];
        formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      }
    });
  }

  if (result?.ok) {
    return (
      <div role="status" className="flex flex-col items-center px-6 py-16 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-7" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">{successTitle}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{successBody}</p>
      </div>
    );
  }

  const errs = result?.fieldErrors ?? {};
  const inputCls =
    "w-full scroll-mt-32 rounded-xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 aria-[invalid=true]:border-destructive/70";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
      {/* Champ piège anti-robot : invisible pour les humains et les lecteurs d'écran */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Ne pas remplir
          <input type="text" name="hp_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {fields.map((f) => {
        const id = `f-${f.name}`;
        const errId = `${id}-err`;
        const err = errs[f.name];
        const common = {
          id,
          name: f.name,
          required: f.required,
          "aria-invalid": err ? true : undefined,
          "aria-describedby": err ? errId : undefined,
          className: inputCls,
        };
        return (
          <div key={f.name} className={cn("flex flex-col gap-2", !f.half && "sm:col-span-2")}>
            <label htmlFor={id} className="text-sm font-medium text-foreground">
              {f.label}
              {f.required ? <span className="text-brand" aria-hidden> *</span> : <span className="text-muted-foreground"> (facultatif)</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea {...common} rows={5} placeholder={f.placeholder} className={cn(inputCls, "resize-y")} />
            ) : f.type === "select" ? (
              <select {...common} defaultValue="">
                <option value="" disabled>
                  Choisir…
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input {...common} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} />
            )}
            {err && (
              <p id={errId} className="text-xs text-destructive">
                {err}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Vos données servent uniquement à vous répondre.{" "}
          <a href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
            Confidentialité
          </a>
        </p>
        <button
          type="submit"
          disabled={pending}
          className="group inline-flex items-center justify-between gap-3 rounded-full bg-primary py-2 pl-6 pr-2 text-sm font-medium text-primary-foreground transition-transform duration-300 ease-spring active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Envoi…" : submitLabel}
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-foreground/10">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />}
          </span>
        </button>
      </div>

      {result?.error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:col-span-2">
          {result.error}
        </p>
      )}
    </form>
  );
}
