import { cn } from "@/lib/utils";
import { ROLE_META } from "@/lib/agents/roles";
import type { AgentRole } from "@/lib/shared/types";
import { DynamicIcon } from "@/components/icon";

const ICON_SIZES = {
  sm: "size-8 rounded-lg [&_svg]:size-4",
  md: "size-10 rounded-lg [&_svg]:size-[1.15rem]",
  lg: "size-12 rounded-xl [&_svg]:size-6",
  xl: "size-14 rounded-xl [&_svg]:size-7",
} as const;

/** Tuile d'icône colorée selon le rôle. */
export function RoleIcon({
  role,
  size = "md",
  className,
}: {
  role: AgentRole;
  size?: keyof typeof ICON_SIZES;
  className?: string;
}) {
  const meta = ROLE_META[role];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        meta.iconWrapClass,
        ICON_SIZES[size],
        className,
      )}
    >
      <DynamicIcon name={meta.icon} />
    </span>
  );
}

/** Pastille de rôle (pour les listes, en-têtes). `label` surcharge le libellé
 *  (utile pour les rôles personnalisés). */
export function RoleBadge({
  role,
  label,
  className,
  withIcon = false,
}: {
  role: AgentRole;
  label?: string;
  className?: string;
  withIcon?: boolean;
}) {
  const meta = ROLE_META[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.badgeClass,
        className,
      )}
    >
      {withIcon ? (
        <DynamicIcon name={meta.icon} className="size-3" />
      ) : (
        <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      )}
      {label || meta.label}
    </span>
  );
}
