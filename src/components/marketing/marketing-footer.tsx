import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "#fonctionnalites" },
      { label: "Rôles d'agents", href: "#roles" },
      { label: "Tarifs", href: "#tarifs" },
      { label: "Tableau de bord", href: "/overview" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Guide de démarrage", href: "#" },
      { label: "Référence API", href: "#" },
      { label: "Statut", href: "#" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Confidentialité", href: "#" },
      { label: "CGU", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container-marketing py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Logo markSize={28} />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              La plateforme française pour créer et déployer des agents vocaux IA
              spécialisés par rôle.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Hébergement en France · Conforme RGPD
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Callpme. Tous droits réservés.
          </p>
          <p className="text-xs text-muted-foreground">Conçu en France.</p>
        </div>
      </div>
    </footer>
  );
}
