"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#produit", label: "Produit" },
  { href: "/#metiers", label: "Métiers" },
  { href: "/#developpeurs", label: "Développeurs" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Navigation « île flottante » : une pilule vitrée détachée du haut de page.
 * Sur mobile, le hamburger se transforme en croix et ouvre un panneau plein
 * écran dont les liens apparaissent en cascade.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  // Menu ouvert : défilement bloqué, focus placé dans le panneau et piégé
  // (Tab / Maj+Tab bouclent), Échap ferme. À la fermeture, le focus revient
  // sur le bouton (WCAG 2.4.3).
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) toggleRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab") return;
      const items = [toggleRef.current, ...focusables()].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 sm:pt-6">
      <div className="pointer-events-auto flex w-full max-w-[880px] items-center justify-between gap-4 rounded-full border border-foreground/10 bg-background/70 py-2 pl-5 pr-2 shadow-lg backdrop-blur-xl">
        <Link href="/" aria-label="Callpme, accueil" onClick={() => setOpen(false)}>
          <Logo markSize={24} />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-300 ease-spring hover:bg-foreground/5 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className="group hidden items-center gap-2 rounded-full bg-primary py-1.5 pl-4 pr-1.5 text-sm font-medium text-primary-foreground transition-transform duration-300 ease-spring active:scale-[0.97] sm:inline-flex"
          >
            Essai gratuit
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-foreground/10 transition-transform duration-300 ease-spring group-hover:-translate-y-px group-hover:translate-x-0.5">
              <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
            </span>
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="relative inline-flex size-10 items-center justify-center rounded-full md:hidden"
          >
            <span
              className={cn(
                "absolute h-px w-5 bg-foreground transition-transform duration-500 ease-spring",
                open ? "rotate-45" : "-translate-y-1",
              )}
            />
            <span
              className={cn(
                "absolute h-px w-5 bg-foreground transition-transform duration-500 ease-spring",
                open ? "-rotate-45" : "translate-y-1",
              )}
            />
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="pointer-events-auto fixed inset-0 -z-10 bg-background/90 backdrop-blur-3xl md:hidden"
      >
        <nav ref={panelRef} aria-label="Menu mobile" className="flex h-full flex-col justify-center gap-2 px-8">
          {[...LINKS, { href: "/login", label: "Connexion" }, { href: "/register", label: "Essai gratuit" }].map(
            (l, i) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${80 + i * 50}ms` }}
                className="animate-fade-up text-3xl font-medium tracking-tight text-foreground"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
