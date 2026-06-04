import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  children,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/overview"
            className="inline-flex items-center transition-colors hover:text-foreground"
            aria-label="Accueil"
          >
            <Home className="size-4" />
          </Link>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-muted-foreground/50" />
              {b.href ? (
                <Link href={b.href} className="transition-colors hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-display-sm font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
