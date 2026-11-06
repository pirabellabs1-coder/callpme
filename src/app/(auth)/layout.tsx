import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Portail d'une agence sur son propre domaine : sa marque, pas celle de la plateforme.
  const host = (headers().get("host") ?? "").split(":")[0].toLowerCase();
  const agency = host
    ? await prisma.organization
        .findFirst({ where: { customDomain: host, customDomainVerifiedAt: { not: null }, plan: "agency" }, select: { brandName: true, brandLogoUrl: true, name: true } })
        .catch(() => null)
    : null;
  if (agency) {
    const name = agency.brandName || agency.name;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
        {agency.brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.brandLogoUrl} alt={name} referrerPolicy="no-referrer" className="mb-8 h-10 w-auto max-w-[200px] object-contain" />
        ) : (
          <p className="mb-8 text-xl font-semibold tracking-tight">{name}</p>
        )}
        <div className="w-full max-w-sm">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Colonne marque */}
      <div className="relative hidden overflow-hidden border-r border-border bg-card lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 10%, hsl(14 81% 54% / 0.28), transparent)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-[0.04]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/80">
            <span className="size-1.5 rounded-full bg-brand" />
            Plateforme d'agents vocaux IA
          </span>
          <h2 className="mt-6 max-w-md text-display-md font-semibold tracking-tight text-foreground text-balance">
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
                className="flex items-center gap-3 text-sm text-foreground/75"
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
    </div>
  );
}
