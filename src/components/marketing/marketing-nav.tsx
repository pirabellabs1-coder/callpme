import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#roles", label: "Rôles" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="container-marketing flex h-16 items-center justify-between">
        <Link href="/" aria-label="Callpme — accueil">
          <Logo markSize={28} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "brand", size: "sm" }), "gap-1.5")}
          >
            Démarrer
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
