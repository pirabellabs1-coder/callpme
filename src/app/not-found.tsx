import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-grain px-6 text-center">
      <Logo markSize={32} />
      <p className="mt-8 mono text-sm font-medium text-brand">404</p>
      <h1 className="mt-2 text-display-sm font-semibold tracking-tight text-foreground">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        href="/overview"
        className={cn(buttonVariants({ variant: "default" }), "mt-7 gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Retour au tableau de bord
      </Link>
    </div>
  );
}
