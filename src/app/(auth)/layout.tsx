import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Colonne formulaire */}
      <div className="flex flex-col bg-background px-6 py-8 sm:px-10">
        <Link href="/" aria-label="Accueil Callpme" className="inline-flex">
          <Logo markSize={28} />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Callpme · Conçu en France
        </p>
      </div>

      {/* Colonne marque */}
      <div className="relative hidden overflow-hidden bg-foreground lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 10%, hsl(14 81% 54% / 0.28), transparent)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-[0.04]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3 py-1 text-xs font-medium text-background/80">
            <span className="size-1.5 rounded-full bg-brand" />
            Plateforme d'agents vocaux IA
          </span>
          <h2 className="mt-6 max-w-md text-display-md font-semibold tracking-tight text-background text-balance">
            Des agents vocaux qui décrochent, comprennent et agissent.
          </h2>
          <ul className="mt-8 space-y-3">
            {[
              "Créez des agents spécialisés par rôle",
              "Déployez-les sur de vrais numéros",
              "Pilotez chaque appel en temps réel",
              "API & webhooks pour tout automatiser",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-background/75"
              >
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand/20 text-brand">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
