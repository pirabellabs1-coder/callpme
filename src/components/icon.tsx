/**
 * Résolveur d'icônes Lucide par nom.
 * Les rôles et les outils stockent un nom d'icône (string) ; ce composant le
 * mappe vers le vrai composant Lucide. Aucune émoji, aucun pictogramme bitmap.
 */
import {
  LifeBuoy,
  CalendarClock,
  Filter,
  PhoneOutgoing,
  Headset,
  ClipboardCheck,
  PhoneForwarded,
  PhoneOff,
  Network,
  MessageSquare,
  CalendarSearch,
  CalendarPlus,
  CalendarX,
  UserPlus,
  Gauge,
  PhoneCall,
  Star,
  PackageSearch,
  Ticket,
  Mail,
  NotebookPen,
  ListChecks,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LifeBuoy,
  CalendarClock,
  Filter,
  PhoneOutgoing,
  Headset,
  ClipboardCheck,
  PhoneForwarded,
  PhoneOff,
  Network,
  MessageSquare,
  CalendarSearch,
  CalendarPlus,
  CalendarX,
  UserPlus,
  Gauge,
  PhoneCall,
  Star,
  PackageSearch,
  Ticket,
  Mail,
  NotebookPen,
  ListChecks,
};

export function DynamicIcon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? CircleHelp;
  return <Cmp className={className} strokeWidth={strokeWidth} aria-hidden />;
}
