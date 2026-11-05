/** Données des métiers (accueil, page Métiers). Module serveur/client neutre. */

export type Trade = {
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

export const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=75`;

export const TRADES: Trade[] = [
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
