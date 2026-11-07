import { Phone } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Remplace l'achat de numéros quand la plateforme n'en vend pas : le client apporte le sien. */
export function BringYourNumber() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-400">
          <Phone className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Apportez votre numéro</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Callpme ne vend pas de numéros pour l&apos;instant. Achetez votre numéro chez votre opérateur
            (Twilio, Telnyx, Vonage…), puis ajoutez-le ci-dessous et reliez-le à un agent : notre équipe l&apos;active avec vous.
          </p>
        </div>
      </div>
    </Card>
  );
}
