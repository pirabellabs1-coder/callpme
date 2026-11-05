"use client";

import Image from "next/image";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vitrine par métier : un onglet par secteur, avec photo, ce que fait
 * l'agent et un extrait de conversation. Onglets accessibles (flèches
 * gauche/droite, rôle tablist).
 */
type Trade = {
  key: string;
  label: string;
  title: string;
  photo: string;
  alt: string;
  credit: { name: string; url: string };
  tasks: string[];
  stat: { value: string; label: string };
  demo: { who: "agent" | "caller"; text: string }[];
};

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=75`;

const TRADES: Trade[] = [
  {
    key: "coiffure",
    label: "Coiffure et beauté",
    title: "Le salon prend les rendez-vous pendant que vous travaillez.",
    photo: u("photo-1695527081848-1e46c06e6458"),
    alt: "Une coiffeuse s'occupe d'une cliente dans un salon",
    credit: { name: "Daniel", url: "https://unsplash.com/@unsplashbydan" },
    tasks: ["Réserve la prestation et la coiffeuse demandée", "Envoie un rappel par SMS la veille pour limiter les absences", "Propose un autre créneau quand le planning est plein"],
    stat: { value: "J−1", label: "rappel SMS envoyé la veille de chaque rendez-vous" },
    demo: [
      { who: "caller", text: "Bonjour, je voudrais une coupe samedi, avec Léa si possible." },
      { who: "agent", text: "Léa est disponible samedi à 10 h. Je vous réserve ce créneau ?" },
      { who: "caller", text: "Oui, parfait." },
    ],
  },
  {
    key: "sante",
    label: "Médecins et cliniques",
    title: "Le cabinet répond à chaque appel.",
    photo: u("photo-1638202993928-7267aad84c31"),
    alt: "Une médecin en blouse blanche tient un stéthoscope",
    credit: { name: "Alexandr Podvalny", url: "https://unsplash.com/@freestockpro" },
    tasks: ["Donne les rendez-vous selon le motif et le praticien", "Oriente les urgences vers le service adapté ou le médecin de garde", "Annule et déplace sans intervention du cabinet"],
    stat: { value: "24 h/24", label: "de prise de rendez-vous, week-ends compris" },
    demo: [
      { who: "caller", text: "Bonjour, mon fils a de la fièvre depuis hier. Le docteur peut-il le voir aujourd'hui ?" },
      { who: "agent", text: "Le docteur Traoré a un créneau à 17 h 15. Quel est le nom de l'enfant ?" },
    ],
  },
  {
    key: "avocat",
    label: "Avocats et notaires",
    title: "Chaque nouveau client est qualifié avant le premier rendez-vous.",
    photo: u("photo-1605602517229-cdbfc3dfb70c"),
    alt: "Un avocat en chemise blanche assis dans un fauteuil de bureau",
    credit: { name: "Steward Masweneng", url: "https://unsplash.com/@stewardesign" },
    tasks: ["Identifie le domaine : famille, travail, immobilier, pénal", "Pose les premières questions et prépare une fiche", "Ne donne jamais de conseil juridique : il fixe un rendez-vous"],
    stat: { value: "1 fiche", label: "prête avant chaque premier rendez-vous" },
    demo: [
      { who: "caller", text: "Bonjour, mon employeur envisage de me licencier. Je souhaite consulter un avocat." },
      { who: "agent", text: "Je note une demande en droit du travail. Avez-vous déjà reçu un courrier de votre employeur ?" },
    ],
  },
  {
    key: "garage",
    label: "Garages",
    title: "Les demandes arrivent déjà triées.",
    photo: u("photo-1723099971299-3789db53604c"),
    alt: "Une voiture surélevée sur un pont dans un atelier mécanique",
    credit: { name: "KC Shum", url: "https://unsplash.com/@kcshum" },
    tasks: ["Note le véhicule, l'immatriculation et le problème", "Planifie révisions et contrôles selon la charge de l'atelier", "Prévient le client quand le véhicule est prêt"],
    stat: { value: "Mains libres", label: "l'atelier continue de travailler, l'agent répond" },
    demo: [
      { who: "caller", text: "Bonjour, ma voiture fait un bruit quand je freine." },
      { who: "agent", text: "Je peux vous proposer un contrôle des freins demain à 8 h 30. Quel est le modèle du véhicule ?" },
    ],
  },
  {
    key: "immobilier",
    label: "Immobilier",
    title: "Les visites se planifient pendant que vous êtes sur le terrain.",
    photo: u("photo-1770199105692-9e52ff137cad"),
    alt: "Une agente immobilière tient des clés et un porte-documents",
    credit: { name: "Aleksandra Sapozhnikova", url: "https://unsplash.com/@rruprrup" },
    tasks: ["Répond sur les annonces : prix, surface, disponibilité", "Qualifie le budget et le financement de l'acheteur", "Réserve la visite dans l'agenda du bon négociateur"],
    stat: { value: "7 j/7", label: "prise de rendez-vous de visite, dimanche compris" },
    demo: [
      { who: "caller", text: "Bonjour, j'appelle pour l'appartement à Ixelles. Est-il toujours disponible ?" },
      { who: "agent", text: "Oui, le deux-chambres à 1 150 € par mois. Je peux vous proposer une visite jeudi à 11 h." },
    ],
  },
  {
    key: "restaurant",
    label: "Restaurants",
    title: "Les réservations sont prises, même pendant le service.",
    photo: u("photo-1577219492769-b63a779fac28"),
    alt: "Un chef prépare des assiettes en cuisine",
    credit: { name: "Louis Hansel", url: "https://unsplash.com/@louishansel" },
    tasks: ["Réserve une table selon le nombre de couverts", "Répond sur le menu, les allergènes et les horaires", "Prend les commandes à emporter"],
    stat: { value: "Sans attente", label: "même aux heures de pointe" },
    demo: [
      { who: "caller", text: "Bonsoir, auriez-vous une table pour six ce soir, vers 20 h ?" },
      { who: "agent", text: "J'ai une table pour six à 20 h 15 en terrasse. À quel nom ?" },
    ],
  },
];

export function TradesShowcase() {
  const [active, setActive] = useState(0);
  const t = TRADES[active];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : TRADES.length - 1)) % TRADES.length;
    setActive(next);
    document.getElementById(`metier-${TRADES[next].key}`)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Métiers"
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      >
        {TRADES.map((tr, i) => (
          <button
            key={tr.key}
            id={`metier-${tr.key}`}
            role="tab"
            aria-selected={i === active}
            aria-controls="panneau-metier"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-300 ease-spring",
              i === active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {tr.label}
          </button>
        ))}
      </div>

      <div
        id="panneau-metier"
        role="tabpanel"
        aria-labelledby={`metier-${t.key}`}
        className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div key={`photo-${t.key}`} className="bezel animate-fade-in">
          <div className="bezel-core relative aspect-[4/5] overflow-hidden lg:aspect-auto lg:h-full lg:min-h-[480px]">
            <Image
              src={t.photo}
              alt={t.alt}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
              priority={active === 0}
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-4xl font-semibold tracking-tight text-white tabular">{t.stat.value}</p>
              <p className="mt-1 max-w-xs text-sm text-white/75">{t.stat.label}</p>
              <p className="mt-4 text-[11px] text-white/50">
                Photo :{" "}
                <a href={`${t.credit.url}?utm_source=callpme&utm_medium=referral`} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  {t.credit.name}
                </a>{" "}
                sur Unsplash
              </p>
            </div>
          </div>
        </div>

        <div key={`text-${t.key}`} className="bezel animate-fade-up">
          <div className="bezel-core flex h-full flex-col p-7 sm:p-9">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{t.title}</h3>
            <ul className="mt-6 space-y-3">
              {t.tasks.map((task) => (
                <li key={task} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden />
                  {task}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-border bg-background/60 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Extrait d'appel
              </p>
              <ol className="flex flex-col gap-2" aria-label={`Exemple de conversation, ${t.label}`}>
                {t.demo.map((d, i) => (
                  <li
                    key={i}
                    style={{ animationDelay: `${150 + i * 350}ms` }}
                    className={cn(
                      "max-w-[88%] animate-fade-up rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed text-foreground",
                      d.who === "agent" ? "self-start bg-foreground/[0.06]" : "self-end bg-brand/15",
                    )}
                  >
                    <span className="sr-only">{d.who === "agent" ? "Agent : " : "Appelant : "}</span>
                    {d.text}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
