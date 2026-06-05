export const metadata = { title: "CGU · Callpme" };

const SECTIONS = [
  {
    h: "1. Éditeur",
    p: "Callpme est édité et exploité par Pirabel Labs, agence à l'origine de la création du service. Contact : contact@pirabellabs.com.",
  },
  {
    h: "2. Objet",
    p: "Les présentes conditions régissent l'accès et l'utilisation de la plateforme Callpme, qui permet de créer, configurer et déployer des agents vocaux IA, ainsi que d'en piloter l'usage par interface ou par API.",
  },
  {
    h: "3. Compte et accès",
    p: "L'accès nécessite la création d'un compte. Vous êtes responsable de la confidentialité de vos identifiants et de vos clés d'API, ainsi que des actions effectuées via votre compte.",
  },
  {
    h: "4. Usage acceptable",
    p: "Vous vous engagez à utiliser le service dans le respect des lois en vigueur, notamment en matière de prospection, d'enregistrement des appels et de protection des données. Tout usage frauduleux ou abusif peut entraîner la suspension du compte.",
  },
  {
    h: "5. Abonnement et facturation",
    p: "Le service est proposé via des offres incluant un volume de minutes. Les dépassements et les numéros sont facturés à l'usage. Les conditions tarifaires en vigueur sont celles affichées sur la page Tarifs.",
  },
  {
    h: "6. Propriété intellectuelle",
    p: "La plateforme, sa marque et ses composants restent la propriété de Pirabel Labs. Vous conservez la propriété de vos contenus (prompts, configurations, transcriptions).",
  },
  {
    h: "7. Responsabilité",
    p: "Le service est fourni « en l'état ». Pirabel Labs met en œuvre les moyens raisonnables pour assurer sa disponibilité mais ne saurait être tenue responsable des interruptions ou des usages réalisés via les agents que vous configurez.",
  },
  {
    h: "8. Droit applicable",
    p: "Les présentes conditions sont régies par le droit français. Tout litige relèvera des tribunaux compétents, à défaut de résolution amiable.",
  },
];

export default function CguPage() {
  return (
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          Légal
        </p>
        <h1 className="mt-2 text-display-md font-semibold tracking-tight text-foreground">
          Conditions générales d'utilisation
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
      </div>
    </div>
  );
}
