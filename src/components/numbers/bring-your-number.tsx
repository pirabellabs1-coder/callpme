import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** Deux façons d'obtenir un numéro : la marketplace Callpme, ou son propre opérateur. */
export function BringYourNumber() {
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-400">
        <Phone className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Obtenir un numéro</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choisissez un numéro local (MTN, Moov…) dans notre catalogue : réseau, pays, début du numéro. Vous pouvez aussi
          ajouter ci-dessous un numéro acheté chez votre opérateur (Twilio, Telnyx…).
        </p>
      </div>
      <Link href="/numbers/acheter" className={buttonVariants({ variant: "brand" })}>
        Acheter un numéro <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}
