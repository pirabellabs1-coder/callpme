import Link from "next/link";
import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { getClientSession, requireClientSession } from "@/lib/auth/session";
import { clientLogout } from "@/app/actions/auth";
import { PortalNav } from "./portal-nav";

export const dynamic = "force-dynamic";

/** Titres d'onglet à la marque de l'agence (le gabarit global mentionne la plateforme). */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getClientSession();
  const brand = s ? s.org.brandName || s.org.name : "Espace client";
  return { title: { template: `%s · ${brand}`, default: brand }, robots: { index: false } };
}

/**
 * Portail d'un client d'agence (marque blanche) : nom et logo de l'agence,
 * nom du client, aucune mention de la plateforme.
 */
export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const s = await requireClientSession();
  const brand = s.org.brandName || s.org.name;
  const color = s.client.brandColor && /^#[0-9a-f]{6}$/i.test(s.client.brandColor) ? s.client.brandColor : null;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#contenu-portail"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Aller au contenu
      </a>
      <header className="border-b border-border bg-card" style={color ? { borderTop: `3px solid ${color}` } : undefined}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/espace" className="flex min-w-0 items-center gap-3">
            {s.org.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.org.brandLogoUrl} alt={brand} className="h-8 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="text-base font-semibold tracking-tight">{brand}</span>
            )}
            <span className="truncate text-sm text-muted-foreground">· {s.client.name}</span>
          </Link>
          <PortalNav />
          <form action={clientLogout} className="ml-auto">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
            >
              <LogOut className="size-4" aria-hidden /> Se déconnecter
            </button>
          </form>
        </div>
      </header>
      <main id="contenu-portail" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
