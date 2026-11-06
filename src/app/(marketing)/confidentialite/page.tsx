import { LegalPage } from "@/components/marketing/sections";

export const metadata = { title: "Politique de confidentialité" };

const SECTIONS = [
  {
    h: "1. Responsable du traitement",
    p: "Callpme est édité et opéré par Pirabel Labs. Pirabel Labs est responsable du traitement des données personnelles collectées via la plateforme. Pour toute question : contact@pirabellabs.com.",
  },
  {
    h: "2. Données collectées",
    p: "Nous collectons les données strictement nécessaires au service : informations de compte (nom, e-mail), configuration de vos agents, journaux et transcriptions des appels que vous générez, et données de facturation. Aucune donnée n'est revendue.",
  },
  {
    h: "3. Finalités et base légale",
    p: "Les données sont traitées pour fournir le service (exécution du contrat), assurer la sécurité, et améliorer la plateforme (intérêt légitime). Les communications marketing reposent sur votre consentement.",
  },
  {
    h: "4. Hébergement",
    p: "La plateforme est pensée pour la conformité RGPD avec un hébergement en Europe. Vous gardez la maîtrise de vos transcriptions et de vos enregistrements, que vous pouvez supprimer à tout moment.",
  },
  {
    h: "5. Durée de conservation",
    p: "Les données sont conservées le temps de la relation contractuelle, puis archivées ou supprimées conformément aux obligations légales. Les appels de test peuvent être supprimés à tout moment depuis votre espace.",
  },
  {
    h: "6. Vos droits",
    p: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez vos droits en écrivant à contact@pirabellabs.com.",
  },
  {
    h: "7. Sous-traitants",
    p: "Nous faisons appel à des prestataires techniques (hébergement, modèles d'IA, téléphonie, e-mail) sélectionnés pour leurs garanties de conformité. La liste est disponible sur demande.",
  },
];

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="Dernière mise à jour : novembre 2026 · Éditeur : Pirabel Labs"
      sections={SECTIONS}
    >
      <p className="rounded-xl border border-border bg-foreground/[0.03] p-5 text-sm text-muted-foreground">
        Pour toute demande relative à vos données, écrivez à{" "}
        <a href="mailto:contact@pirabellabs.com" className="font-medium text-foreground underline underline-offset-4">
          contact@pirabellabs.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
