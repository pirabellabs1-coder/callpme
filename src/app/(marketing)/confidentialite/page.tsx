export const metadata = { title: "Confidentialité · Callpme" };

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
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          Légal
        </p>
        <h1 className="mt-2 text-display-md font-semibold tracking-tight text-foreground">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Dernière mise à jour : juin 2026 · Éditeur : Pirabel Labs
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-semibold tracking-tight text-foreground">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground text-pretty">{s.p}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Ce document est un résumé informatif. Pour toute demande relative à vos
          données, contactez <strong className="text-foreground">Pirabel Labs</strong> à{" "}
          <a href="mailto:contact@pirabellabs.com" className="font-medium text-brand hover:underline">
            contact@pirabellabs.com
          </a>.
        </p>
      </div>
    </div>
  );
}
