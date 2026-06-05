import Link from "next/link";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { confirmAndActivatePayment } from "@/lib/payments/confirm";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Paiement · Callpme" };
export const dynamic = "force-dynamic";

export default async function RetourPage({
  searchParams,
}: {
  searchParams: { pid?: string; e?: string };
}) {
  const pid = searchParams.pid;
  const errored = searchParams.e === "1";

  let state: "completed" | "pending" | "failed" | "notfound" = "pending";
  if (errored) state = "failed";
  else if (pid) state = await confirmAndActivatePayment(pid);

  const ui =
    state === "completed"
      ? {
          icon: CheckCircle2,
          color: "text-emerald-600",
          title: "Paiement confirmé",
          text: "Votre offre est activée. Merci ! Vous pouvez retourner à votre espace.",
        }
      : state === "pending"
        ? {
            icon: Clock,
            color: "text-amber-600",
            title: "Paiement en cours de confirmation",
            text: "Votre paiement est en cours de validation. Cette page se mettra à jour, ou rechargez dans un instant.",
          }
        : {
            icon: XCircle,
            color: "text-destructive",
            title: "Paiement non abouti",
            text: "Le paiement n'a pas été finalisé. Vous pouvez réessayer depuis la facturation.",
          };

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="p-8 text-center">
        <span className={cn("inline-flex items-center justify-center", ui.color)}>
          <ui.icon className="size-12" strokeWidth={1.5} />
        </span>
        <h1 className="mt-4 text-display-sm font-semibold tracking-tight text-foreground">
          {ui.title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
          {ui.text}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/overview" className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}>
            Aller à mon espace
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/billing" className={cn(buttonVariants({ variant: "outline" }))}>
            Facturation
          </Link>
        </div>
      </Card>
    </div>
  );
}
