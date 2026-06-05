import { Mail, Building2, ExternalLink, LifeBuoy } from "lucide-react";

export const metadata = { title: "Contact · Callpme" };

const ITEMS = [
  {
    icon: Mail,
    title: "Email",
    body: "Écrivez-nous, nous répondons sous 1 jour ouvré.",
    action: { label: "contact@pirabellabs.com", href: "mailto:contact@pirabellabs.com" },
  },
  {
    icon: LifeBuoy,
    title: "Support",
    body: "Une question sur votre compte ou vos agents ?",
    action: { label: "contact@pirabellabs.com", href: "mailto:contact@pirabellabs.com?subject=Support%20Callpme" },
  },
  {
    icon: Building2,
    title: "Pirabel Labs",
    body: "Callpme est une solution de Pirabel Labs, l'agence créatrice.",
    action: { label: "pirabellabs.com", href: "https://pirabellabs.com", external: true },
  },
];

export default function ContactPage() {
  return (
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          Contact
        </p>
        <h1 className="mt-2 text-display-lg font-semibold tracking-tight text-foreground text-balance">
          Parlons de votre projet.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground text-pretty">
          Une question, une démo, un besoin sur-mesure ? L'équipe Pirabel Labs,
          créatrice de Callpme, vous répond.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {ITEMS.map((it) => (
            <div key={it.title} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-5">
                <it.icon strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 font-semibold tracking-tight text-foreground">{it.title}</h2>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground text-pretty">{it.body}</p>
              <a
                href={it.action.href}
                target={it.action.external ? "_blank" : undefined}
                rel={it.action.external ? "noopener noreferrer" : undefined}
                className="mt-4 inline-flex items-center gap-1.5 break-all text-sm font-semibold text-brand hover:underline"
              >
                {it.action.label}
                {it.action.external && <ExternalLink className="size-3.5 shrink-0" />}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
