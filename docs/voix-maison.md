# Voix maison Callpme : document de décision

*Rédigé le 6 novembre 2026. Destiné au fondateur : pas besoin d'être technicien pour le lire.*
*Les licences ont été vérifiées sur les dépôts officiels (GitHub et fiches Hugging Face) à cette date. Tout ce qui n'a pas pu être vérifié est marqué **non vérifié**.*

---

## 1. En bref

- **Objectif.** Avoir nos propres voix, de qualité proche d'ElevenLabs. Elles seraient enregistrées avec de vrais locuteurs (consentement signé), entraînées et servies sur nos machines. Nous ne paierions plus ElevenLabs au caractère.
- **Ce qui est interdit.** On ne peut **pas** partir des voix ElevenLabs. Leurs conditions interdisent d'utiliser leurs sons pour entraîner un modèle, et aucun modèle de voix ne s'exporte (section 3). Il faut **enregistrer nos propres locuteurs**.
- **Modèle recommandé.** **Orpheus 3B français** (Canopy Labs, poids sous Apache-2.0, base Llama 3.2). C'est aujourd'hui le seul candidat qui réunit :
  - une licence commerciale ;
  - du français ;
  - un script officiel pour affiner sur une voix ;
  - de la diffusion en flux d'environ 200 ms.

  Deux alternatives sont à comparer **sur le même enregistrement** avant de choisir : Chatterbox Multilingual (MIT) et StyleTTS 2 (MIT).
- **Coût d'hébergement.** Un GPU allumé en permanence coûte de **≈ 215 €/mois** (Hetzner, serveur dédié) à **≈ 430–800 $/mois** (RunPod, L4 ou L40S). Le coût le plus lourd est ailleurs : enregistrer 1 à 3 h de voix propre par locuteur (studio, comédien, relecture des transcriptions).
- **Ce qui est déjà construit dans Callpme** (section 9). Un espace super-admin « Voix maison » :
  - consentement signé obligatoire ;
  - dépôt ou enregistrement des clips ;
  - lancement d'un entraînement et suivi de son état ;
  - écoute et publication au catalogue ;
  - un fournisseur vocal « callpme » dans le moteur téléphonique.

  Ce fournisseur reste **éteint** tant qu'aucun serveur n'est configuré : **ElevenLabs reste la voix par défaut**. Le serveur GPU d'entraînement **n'existe pas encore**. Son interface est prête et documentée (annexe B), mais il reste à le construire et à l'héberger.

---

## 2. Pourquoi, et ce que ça change

| | Aujourd'hui (ElevenLabs) | Avec nos voix |
|---|---|---|
| Coût | Proportionnel aux caractères prononcés | Coût fixe par GPU allumé, quel que soit le volume |
| Dépendance | Un fournisseur peut changer ses prix ou ses règles | Nous maîtrisons le modèle et ses versions |
| Identité | Voix partagées avec d'autres sociétés | Voix exclusives (accents béninois et ouest-africains) |
| Qualité | Excellente, immédiate | À construire. Le risque principal est la qualité perçue au téléphone |
| Effort | Nul | Enregistrement, entraînement, exploitation d'un serveur GPU |

**Le calcul qui décide.** Les voix maison deviennent rentables quand la facture ElevenLabs mensuelle dépasse le coût d'un ou deux GPU (≈ 215 à 1 600 €/mois selon l'hébergeur), plus le temps d'exploitation.

- En dessous de ce seuil, ElevenLabs reste moins cher.
- Le nombre d'appels simultanés qu'un GPU peut servir avec Orpheus 3B est **non vérifié**. Il doit être mesuré pendant le banc d'essai (étape 2 du plan). C'est ce chiffre qui fixe le nombre de GPU nécessaires.

---

## 3. Ce qu'ElevenLabs interdit (à lire avant tout)

Sources : [Conditions d'utilisation](https://elevenlabs.io/terms-of-use) et [Prohibited Use Policy](https://elevenlabs.io/use-policy), version du 9 octobre 2026.

- **Entraîner un modèle avec leurs sons : interdit.** La Use Policy (§12, « Commercial and Technical Restrictions ») interdit d'utiliser leurs services ou leurs sons générés pour « develop, train, fine-tune, or improve any AI model ». Elle interdit aussi de créer des produits qui les concurrencent. Les voix maison sont précisément un produit concurrent.
- **Exporter un modèle de voix : impossible.**
  - Les conditions (§4(a)) permettent seulement de télécharger certains *sons* générés, pas les modèles.
  - Pour nos propres clones de voix, le §4(b) prévoit seulement d'en demander la suppression. Aucune clause ne permet d'exporter un modèle de voix, qu'il soit instantané ou professionnel.
  - L'avenant « Voice Library » n'a pas été lu en entier : **non vérifié**. Rien n'indique cependant qu'il autorise un export.
- **Conséquence pratique.**
  - On n'utilise aucun appel enregistré produit par ElevenLabs comme données d'entraînement, même « juste pour essayer ».
  - On ne fait pas imiter une voix du catalogue ElevenLabs par un locuteur.
  - Les jeux de données maison viennent **uniquement** d'enregistrements de vraies personnes, consentantes et rémunérées.
- ElevenLabs exige aussi le consentement explicite pour cloner une voix (Use Policy §3). Nous appliquons la même règle chez nous.

> Le code de Callpme suit déjà ce principe. Les clips ne peuvent être déposés que dans l'espace « Voix maison », derrière une attestation de consentement, et rien n'y aspire de son ElevenLabs.

---

## 4. Les modèles open source comparés

**Comment lire le tableau.**

- **Code / poids.** Un modèle a deux licences : celle du *programme* et celle des *poids*, c'est-à-dire le « cerveau » entraîné. Les deux doivent autoriser l'usage commercial.
- **Affinage.** C'est le fait d'apprendre une voix précise à partir d'enregistrements. Le « clonage zero-shot », lui, imite une voix à partir de quelques secondes. Ce clonage donne rarement une qualité téléphonique stable.
- **Latence.** C'est le temps avant que la voix commence à parler. Au téléphone, au-delà de ~500 ms, l'agent paraît lent.

### 4.1 Candidats possibles (français + usage commercial autorisé)

| Modèle | Licence code / poids | Français | Flux et latence (source officielle) | Taille, GPU | Affinage sur une voix |
|---|---|---|---|---|---|
| **Orpheus 3B FR** ([GitHub](https://github.com/canopyai/Orpheus-TTS), [HF](https://huggingface.co/canopylabs/3b-fr-ft-research_release)) | Apache-2.0 / Apache-2.0 sur la fiche FR. Base Llama 3.2 3B : licence Llama à respecter (voir 5.3) | Oui, version « research release » affinée en français. Accès sur demande | Flux ~200 ms, ~100 ms avec texte en flux | 3 milliards de paramètres. Servi via vLLM. VRAM non chiffrée (estimation : un GPU 24 Go) | **Script officiel** `finetune/train.py`, LoRA possible. Minimum ~50 exemples, **~300 par locuteur recommandés** |
| **Chatterbox Multilingual** ([GitHub](https://github.com/resemble-ai/chatterbox), [HF](https://huggingface.co/ResembleAI/chatterbox)) | MIT / MIT | Oui, natif (23+ langues) | Flux non documenté. Les « < 200 ms » annoncés concernent l'API payante de Resemble | 0,5 milliard. VRAM non chiffrée | Pas de script officiel, seulement des LoRA communautaires. **Dépôt déclaré « retired research », plus maintenu depuis août 2026.** Filigrane audio PerTh sur toutes les sorties (un plus pour la traçabilité) |
| **StyleTTS 2** ([GitHub](https://github.com/yl4579/StyleTTS2)) | MIT / poids publiés sous condition : signaler que la voix est synthétique, ou avoir l'accord du locuteur | Par affinage (PL-BERT multilingue) | Non chiffrée. Modèle léger | Petit modèle. Entraînement lourd | **Script officiel** `train_finetune.py` : ~1 h de données ≈ 4 h sur 4×A100. Données à 24 kHz |
| **Zonos v0.1** ([GitHub](https://github.com/Zyphra/Zonos)) | Apache-2.0 / Apache-2.0 | Oui, natif | ~2× temps réel sur RTX 4090. Flux non mentionné | ~2 milliards, ≥ 6 Go de VRAM, 44 kHz | Affinage **non documenté**. Clonage zero-shot seulement |
| **OpenVoice v2** ([GitHub](https://github.com/myshell-ai/OpenVoice)) | MIT / MIT | Oui, natif | Non documenté | Non vérifié | Clonage du timbre par-dessus MeloTTS. Affinage non documenté. Qualité en retrait sur les modèles récents |
| **Kyutai TTS 1.6B en_fr** ([HF](https://huggingface.co/kyutai/tts-1.6b-en_fr)) | MIT / CC-BY 4.0 (attribution) | Oui, natif EN + FR | **Flux natif**, conçu pour le temps réel. Facile à grouper (« 75× ») | 1,8 milliard | **Impossible de créer sa propre voix** : seulement des voix pré-calculées par Kyutai |
| **Piper** ([piper1-gpl](https://github.com/OHF-Voice/piper1-gpl)) | GPL-3.0 / une licence par voix (FR : siwis CC-BY, upmc CC-BY-SA, tom AGPLv3, gilles CC0) | Oui | Très rapide, tourne sur processeur | Minuscule. 8 Go de VRAM suffisent pour entraîner | Script officiel (`TRAINING.md`). Qualité nettement inférieure : voix « robotique » à l'oreille d'un client |
| **Kokoro-82M** ([HF](https://huggingface.co/hexgrad/Kokoro-82M)) | Apache-2.0 / Apache-2.0 | Une seule voix FR (ff_siwis, notée B-) | Rapide | 82 millions | Pas d'entraînement officiel. Pas de clonage |
| **CosyVoice 2 / Fun-CosyVoice 3** ([GitHub](https://github.com/FunAudioLLM/CosyVoice)) | Apache-2.0 / **licence des poids non vérifiée** | Oui (9 langues) | Bi-flux « dès 150 ms » | 0,5 milliard | Recettes d'entraînement officielles. **À écarter tant que la licence des poids n'est pas confirmée** |
| **NeuTTS Air / Nano** ([GitHub](https://github.com/neuphonic/neutts-air)) | Air : Apache-2.0. Nano (dont FR) : « NeuTTS Open License 1.0 », **termes non lus** | Variante Nano FR | Flux via GGUF | 229 à 552 millions | `examples/finetune.py`. À réexaminer quand la licence Nano sera lue |
| **Higgs Audio v2** ([HF](https://huggingface.co/bosonai/higgs-audio-v2-generation-3B-base)) | Apache-2.0 / licence communautaire Boson : commercial jusqu'à 100 000 utilisateurs actifs par an. La v3 est non commerciale | **Français non vérifié** | Non chiffrée | 6 milliards | Non documenté |

### 4.2 À exclure pour un SaaS commercial

| Modèle | Raison |
|---|---|
| **XTTS-v2** (Coqui) | Poids sous *Coqui Public Model License* : **aucun usage commercial**, ni du modèle ni de ses sons. La fermeture de Coqui fin 2023 n'est confirmée que par des sources tierces (**non vérifié**). Aucune licence commerciale n'est achetable aujourd'hui |
| **F5-TTS** | Code MIT, mais **poids CC-BY-NC** (données Emilia). Le fine-tune français communautaire est lui aussi en CC-BY-NC |
| **Fish Speech / OpenAudio** | Licences propriétaires : un service hébergé exige une licence écrite séparée, et S1-mini est en CC-BY-NC-SA |
| **Voxtral-4B-TTS** (Mistral) | Poids CC-BY-NC. Usage commercial seulement via l'API payante de Mistral |
| **VibeVoice** (Microsoft) | Microsoft déconseille l'usage commercial. Code de synthèse retiré en septembre 2025 |
| **Spark-TTS, Llasa, MaskGCT** | Poids non commerciaux, pas de français |
| **MegaTTS3, IndexTTS2** | Pas de français, ou licence « recherche » / sur contact |
| **Dia, Sesame CSM** | Anglais seulement |

> **Classements d'écoute** (« arenas ») : le classement TTS-Arena n'a pas pu être consulté, **non vérifié**. La qualité doit donc être jugée **par nos propres écoutes**, au téléphone (8 kHz), par des auditeurs béninois.

---

## 5. Recommandation : le chemin proposé

### 5.1 Le plan en 6 étapes

| # | Étape | Durée indicative | Décision ou achat |
|---|---|---|---|
| 1 | **Juridique** : faire valider le formulaire de consentement (annexe A) par un juriste au Bénin. Déclarer le traitement auprès de l'APDP si nécessaire (la voix est une donnée personnelle, voire biométrique) | 2–4 semaines | Honoraires juriste |
| 2 | **Banc d'essai** : enregistrer **un** locuteur, 1 h. Affiner Orpheus FR, Chatterbox Multilingual et StyleTTS 2 sur ces mêmes données. Faire écouter en aveugle par 10 à 20 personnes, au téléphone. Mesurer la latence et le nombre d'appels simultanés par GPU | 3–4 semaines | GPU loué à l'heure (≈ 50–150 $ au total) |
| 3 | **Choix du modèle** sur les résultats de l'étape 2. Si aucun n'est assez bon, on reste sur ElevenLabs. Rien n'est perdu : le code Callpme ne change pas | 1 jour | Vous |
| 4 | **Enregistrements de production** : 2 à 4 voix (femmes et hommes, accents locaux), 1 à 3 h chacune | 4–8 semaines | Studio, comédiens, relecture |
| 5 | **Serveur d'inférence** sur un GPU, puis branchement (`CALLPME_TTS_URL`). Publication d'**une** voix à quelques clients pilotes | 2–3 semaines | GPU mensuel |
| 6 | **Bascule progressive** : les nouvelles voix deviennent proposées par défaut, ElevenLabs reste en secours | continu | — |

### 5.2 Pourquoi Orpheus en premier

- **C'est le seul candidat qui coche toutes les cases.** Licence commerciale, français, affinage officiel documenté (combien d'exemples, quel script) et diffusion en flux d'environ 200 ms.
- **Pour les alternatives, il manque toujours quelque chose.**
  - Chatterbox n'a ni flux documenté ni script officiel, et son dépôt n'est plus maintenu.
  - StyleTTS 2 est plus exigeant à entraîner.
  - Kyutai ne sait pas apprendre une voix nouvelle.
- **Risques connus.**
  - La version française est une « research release » : sa qualité est à confirmer en écoute.
  - Un modèle de 3 milliards de paramètres demande un vrai GPU (24 Go conseillés).
  - Le nombre d'appels simultanés par GPU est inconnu tant qu'on ne l'a pas mesuré.

### 5.3 Point de licence à faire relire

Orpheus est construit sur Llama 3.2 de Meta. La fiche du modèle français affiche Apache-2.0, mais la *licence communautaire Llama 3.2* s'applique probablement en plus.

D'après notre connaissance de cette licence, elle autorise l'usage commercial avec une mention « Built with Llama ». Une licence spéciale est requise au-delà de 700 millions d'utilisateurs mensuels. Ce point n'a **pas** été relu sur le texte officiel lors de cette recherche : **à faire confirmer par le juriste à l'étape 1**.

---

## 6. Protocole d'enregistrement (avec consentement signé)

### 6.1 Avant d'enregistrer

1. **Consentement écrit** du locuteur (annexe A), signé **avant** la première séance. Il précise :
   - les usages (entraîner un modèle, faire parler des agents téléphoniques de clients Callpme) ;
   - la durée ;
   - la rémunération ;
   - le **droit de retrait** à tout moment.
2. Une copie est remise au locuteur. Le formulaire signé est déposé dans l'admin Callpme : c'est **obligatoire** avant d'ajouter un seul clip.
3. On vérifie l'identité : pièce d'identité vue, *jamais stockée* dans Callpme.

### 6.2 Conditions techniques

- **Pièce calme**, traitée si possible (couvertures, mousse). Pas de ventilateur ni de climatisation pendant la prise.
- **Le même micro** tout au long du projet (micro USB cardioïde correct ou micro XLR + interface). Distance constante de 15 à 20 cm, filtre anti-pop.
- **Format** : WAV mono non compressé, 48 kHz (24 kHz minimum), 16 bits. L'admin n'accepte **que le WAV** (la durée est relue dans le fichier). Il refuse le MP3, le stéréo et ce qui est sous 16 kHz. L'enregistrement au micro depuis la page produit directement un WAV.
- **Clips de 3 à 15 secondes**, une phrase chacun. L'admin accepte de 1 à 30 s.
- **Transcription exacte**, mot pour mot, y compris les hésitations si on les garde. Une erreur de transcription apprend une erreur au modèle.

### 6.3 Quoi faire lire

- Des phrases **du métier** : accueil, prise de rendez-vous, confirmation, relance, transfert, « pouvez-vous répéter ? ».
- **Nombres, dates, heures, prix en FCFA, numéros de téléphone** béninois (+229), noms de quartiers et de villes (Cotonou, Porto-Novo, Parakou, Abomey-Calavi…).
- Des **questions** et des **exclamations** pour l'intonation, avec un ton chaleureux mais posé.
- **Volume visé** : ≥ 300 clips et ≥ 30 min (c'est le minimum technique, bloqué dans l'admin). Pour une qualité professionnelle, visez **1 à 3 h par voix**.

### 6.4 Contrôle qualité

- Réécouter chaque clip dans l'admin. Supprimer ceux qui ont un bruit, un souffle, une saturation ou une erreur de lecture.
- Garder la même énergie d'une séance à l'autre (séances de 1 à 2 h, pauses régulières).

---

## 7. L'entraînement (affinage)

1. Depuis l'admin, l'équipe choisit le modèle de base et clique « Lancer l'entraînement ». Callpme vérifie :
   - le consentement ;
   - la taille du jeu de données ;
   - qu'aucun entraînement n'est déjà en cours.
2. **Si un serveur d'entraînement est configuré** (`CALLPME_TRAINING_URL`), Callpme lui envoie la tâche. Le serveur télécharge les clips, entraîne, puis signale l'avancement jusqu'à « réussi » (contrat en annexe B).
3. **Tant qu'il n'existe pas**, la tâche reste « en attente », avec un message clair, sans simulation. L'équipe peut alors entraîner à la main sur un GPU loué, avec le script officiel du modèle choisi. Elle déploie ensuite le modèle sur le serveur d'inférence sous l'identifiant `cpm_<identifiant de la tâche>` affiché dans l'admin. Il suffit enfin de cliquer « Mode manuel : le modèle est déployé ».
4. Callpme vérifie alors que le modèle **parle réellement** avant de créer une **version** (brouillon).
5. On **écoute** la version dans l'admin (rendu téléphone 8 kHz, texte libre), puis on la **publie** au catalogue. Un échantillon est généré une fois pour toutes pour l'aperçu client.

**Coût d'un entraînement** : quelques heures de GPU loué, soit de l'ordre de 5 à 50 $ selon le modèle et la quantité de données. C'est une estimation, à mesurer à l'étape 2.

---

## 8. Hébergement : où et combien

Prix publics relevés le 6 novembre 2026, hors TVA, pour un GPU allumé 24 h/24 (730 h/mois).

| Hébergeur | Machine | Prix | Remarques |
|---|---|---|---|
| **Hetzner** (Finlande) | GEX45, RTX PRO 4000 Blackwell 24 Go, serveur dédié | **214 €/mois** + 209 € de mise en service | Le moins cher pour un service permanent. Exploitation à notre charge |
| Hetzner | GEX63, RTX PRO 6000 96 Go | 999 €/mois | Plusieurs voix, beaucoup d'appels |
| **RunPod** Secure | L4 24 Go | 0,59 $/h ≈ **431 $/mois** | Location à l'heure, idéal pour le banc d'essai et les entraînements |
| RunPod Secure | L40S 48 Go | 1,09 $/h ≈ 796 $/mois | Marge confortable pour un modèle 3B |
| RunPod Community | L4 / L40S | 0,44 $ / 0,79 $ par heure | Moins cher, moins fiable (machines de particuliers) |
| Modal | L4 / L40S | ≈ 0,80 $ / 1,95 $ par heure | Facturé à la seconde. Pratique pour les entraînements ponctuels |
| OVHcloud (France) | L4 / L40S | à partir de 1,00 $ / 1,80 $ par heure | Hébergeur européen |
| Scaleway (France) | L4 / L40S | ≈ 0,79 € / 1,47 € par heure | **Non vérifié** (page officielle inaccessible, chiffre d'un tiers) |
| Fly.io (où tourne déjà `callpme-voix`) | GPU | **Non vérifié** | Fly réduit ses ambitions GPU. Notre essai Fly n'a de toute façon pas de carte bancaire |

**Afrique.** Aucun GPU trouvé chez RunPod, Modal, Lambda ni Google Cloud en Afrique. Des acteurs locaux existent (HostAfrica à Johannesburg, Cassava, Safari Cloud), mais leurs prix sont sur devis, **non vérifié**. Rien trouvé à Lagos.

Est-ce un problème ? Pour la voix, la latence réseau Europe ↔ Bénin (≈ 100–150 ms) s'ajoute au temps de génération. C'est acceptable pour démarrer, à mesurer.

**Proposition.**

- **Banc d'essai et entraînements** : RunPod ou Modal à l'heure. Pas d'engagement, quelques dizaines de dollars.
- **Production** : un serveur Hetzner GEX45 (214 €/mois) si un GPU 24 Go suffit au débit mesuré. Sinon un L40S chez RunPod.
- Prévoir **deux** machines dès qu'un client en dépend, pour la redondance. En attendant, ElevenLabs sert de secours automatique.

---

## 9. Ce qui est construit dans Callpme (cette branche)

### Réel et testé

- **Base de données** (Prisma) :
  - `InhouseVoice` : la voix ;
  - `InhouseVoiceConsent` : formulaire signé conservé, date, version du formulaire, attestation de l'admin, révocation ;
  - `InhouseVoiceClip` : audio et transcription ;
  - `InhouseTrainingJob` : états en attente, envoyé, en cours, réussi, échec, annulé ;
  - `InhouseVoiceVersion` : brouillon, publiée, retirée, avec l'échantillon.
- **Page super-admin `/admin/voix-maison`**, derrière la porte admin existante (URL secrète + phrase secrète + compte super-admin). On peut y :
  - créer une voix ;
  - déposer le consentement signé (PDF, JPEG ou PNG). Il est **obligatoire** : sans lui, aucun clip ;
  - déposer des clips WAV ou **les enregistrer au micro** dans le navigateur (convertis en WAV). Le format, la durée et le mono ≥ 16 kHz sont vérifiés sur le fichier réel, côté serveur. Chaque clip exige une attestation. Plafond de 2 500 clips par voix ;
  - écouter et supprimer un clip, et suivre la progression vers le minimum ;
  - lancer, suivre ou annuler un entraînement (mode manuel inclus) ;
  - écouter une version avec un texte libre, la publier au catalogue ou la retirer ;
  - **révoquer le consentement**. Cela annule les entraînements, retire les versions du catalogue, coupe immédiatement la voix au téléphone et **supprime tous les enregistrements** (clips et échantillons). Seuls le formulaire signé et la date de révocation restent, comme preuve.
- **Fournisseur vocal « callpme »** dans le moteur téléphonique. Il appelle `CALLPME_TTS_URL` et diffuse le µ-law 8 kHz en flux. Il est **inactif sans cette variable**.
  - Les voix maison n'apparaissent alors pas aux clients.
  - Un agent qui en aurait une retombe automatiquement sur la voix ElevenLabs par défaut.
  - Il en va de même si la voix est retirée ou si le consentement est révoqué. Cette vérification lit la version publiée et le consentement, pas seulement le catalogue : réactiver la voix à la main dans « Voix » ne suffit pas.
  - **En cours d'appel**, si le serveur maison tombe ou ne répond pas en 4 s, le moteur bascule sur la voix ElevenLabs du catalogue et redit la phrase. L'appelant n'entend pas de silence.
- **Routes du serveur d'entraînement** (`/api/inhouse-training/...`), protégées par un secret partagé : manifeste du jeu de données, téléchargement des clips, rapports d'avancement.
- **Sécurité** : envois admin refusés s'ils ne viennent pas de l'application (contrôle d'origine), fichiers servis sans cache et sans exécution possible, formulaire de consentement téléchargé plutôt qu'affiché.
- **Ce qui ne supprime pas** côté serveur d'inférence : si un modèle a déjà été déployé, Callpme cesse de l'appeler à la révocation, mais l'équipe doit aussi **effacer le modèle sur le serveur GPU** (étape manuelle tant que ce serveur n'existe pas).

### Simulé ou à construire (dit clairement)

- **Le serveur GPU d'entraînement n'existe pas.** Seule son interface est prête (annexe B). Sans lui, un entraînement reste « en attente ».
- **Le serveur d'inférence n'existe pas.** Il faut l'écrire (Python : modèle choisi + petit serveur HTTP en flux) et l'héberger. Sans lui, écoute et publication sont désactivées dans l'admin.
- **Stockage audio.** Les clips sont stockés dans la base Postgres, limités à 4 Mo par clip. C'est suffisant pour démarrer, mais 3 h de voix représentent ≈ 0,5 à 1 Go par locuteur. Il faudra passer à un stockage objet (Supabase Storage) avant d'enregistrer plusieurs voix.
- Les voix maison **ne passent pas par le Studio** de réglages, qui est propre à ElevenLabs. Elles se choisissent directement dans la configuration de l'agent.
- Le schéma doit être appliqué à la base (`npx prisma db push`) avant d'utiliser la page. **Cela n'a pas été fait** : aucun déploiement sur cette branche.

---

## 10. Ce que vous devez décider ou acheter

1. **Go / no-go du banc d'essai** (étape 2). Budget ≈ 50–150 $ de GPU, plus un locuteur rémunéré pour 1 h de voix utile (≈ 2 à 3 h de séance).
2. **Juriste au Bénin** : valider le formulaire (annexe A), la conformité au Code du numérique et à l'APDP, et la licence Llama (5.3).
3. **Locuteurs** : combien de voix, quels profils (genre, âge, accent), quelle rémunération. Paiement unique, ou redevance tant que la voix est utilisée ?
4. **Hébergeur** pour la production. Il faut une carte bancaire chez RunPod ou Hetzner : l'essai Fly.io n'en a pas.
5. **Qui construit et exploite** les deux serveurs Python (inférence + entraînement) : nous, ou un prestataire ?
6. **Stockage objet** pour les clips avant la deuxième voix (Supabase Storage, inclus dans l'offre actuelle ou payant selon le volume).

---

## Annexe A — Modèle de formulaire de consentement (version `2026-11-v1`)

*Modèle à faire valider par un juriste. La version validée doit garder le même identifiant ou en recevoir un nouveau. Dans ce cas, mettre à jour `CONSENT_FORM_VERSION` dans `src/lib/voices/inhouse/rules.ts`.*

> **Consentement à l'enregistrement et à l'utilisation de ma voix — Callpme**
>
> Je soussigné(e) ………………………… (nom, prénoms), né(e) le ………… , joignable au ………………… ,
>
> 1. accepte que ma voix soit **enregistrée** par Callpme lors de séances dont les dates me sont communiquées à l'avance ;
> 2. accepte que ces enregistrements servent à **entraîner un modèle informatique de synthèse vocale** capable de produire une voix ressemblant à la mienne ;
> 3. accepte que cette voix de synthèse soit **proposée aux clients de Callpme** pour faire parler leurs agents téléphoniques (accueil, rendez-vous, relances), sans que je valide chaque phrase prononcée ;
> 4. comprends que Callpme **n'utilisera pas** ma voix pour des contenus politiques, religieux, sexuels, diffamatoires ou frauduleux. Ses clients s'engagent à la même interdiction ;
> 5. reçois en contrepartie : ………………… (montant, modalités, éventuelle redevance) ;
> 6. consens pour une durée de ……… ans, renouvelable par écrit ;
> 7. peux **retirer mon consentement à tout moment** par écrit à ………………… . Callpme cesse alors d'utiliser la voix au téléphone sous 72 h, supprime mes enregistrements et les modèles entraînés avec eux. Les sommes déjà versées restent acquises ;
> 8. ai été informé(e) que ma voix est une donnée personnelle protégée par la loi béninoise (Code du numérique). Je dispose d'un droit d'accès, de rectification et de suppression.
>
> Fait à …………… , le …………… , en deux exemplaires.
> Signature du locuteur : ……………   Signature pour Callpme : ……………

---

## Annexe B — Contrats techniques (pour l'équipe qui construira les serveurs)

### B.1 Serveur d'inférence (voix au téléphone)

```
POST {CALLPME_TTS_URL}/v1/tts/stream
Authorization: Bearer {CALLPME_TTS_API_KEY}      (facultatif mais recommandé)
Content-Type: application/json

{ "text": "Bonjour…", "voice": "cpm_<jobId>", "language": "fr", "speed": 1.0, "format": "ulaw_8000" }

→ 200  Content-Type: application/octet-stream, Transfer-Encoding: chunked
   corps : octets G.711 µ-law, 8 kHz, mono, bruts (sans en-tête), envoyés dès la première syllabe.
→ 4xx/5xx en cas d'erreur (le moteur coupe proprement la phrase).
```

- `voice` est l'identifiant attribué par Callpme à l'entraînement (`cpm_` + identifiant de la tâche). Le serveur charge le modèle (ou l'adaptateur LoRA) correspondant.
- `speed` est borné entre 0,7 et 1,5.
- Le serveur rééchantillonne la sortie du modèle (24 à 44 kHz) en 8 kHz µ-law.
- En production, utiliser HTTPS. Seul le réseau privé (`*.internal` Fly, localhost, adresses privées) est accepté en HTTP.
- Code côté Callpme : `src/lib/voice-engine/callpme-tts.ts`.

### B.2 Serveur d'entraînement GPU

1. **Callpme → serveur.** `POST {CALLPME_TRAINING_URL}/v1/jobs` avec `Authorization: Bearer {CALLPME_TRAINING_SECRET}`.

   ```json
   { "jobId": "…", "modelRef": "cpm_…", "baseModel": "orpheus-fr", "language": "fr",
     "datasetUrl": "https://…/api/inhouse-training/jobs/<jobId>/dataset",
     "statusUrl":  "https://…/api/inhouse-training/jobs/<jobId>/status" }
   ```

   Réponse attendue : `202 { "externalJobId": "…" }`.

2. **Serveur → Callpme.** Le serveur télécharge le jeu de données, avec le même jeton Bearer :
   - `GET datasetUrl` renvoie le manifeste `{ clips: [{ id, transcript, mimeType, durationMs, url }] }` ;
   - puis `GET url` pour chaque clip.

   Callpme refuse (403) si la tâche est annulée ou si le consentement est révoqué.

3. **Serveur → Callpme.** Le serveur rend compte de l'avancement : `POST statusUrl { "status": "running" | "succeeded" | "failed" | "canceled", "progress": 0-100, "message": "…" }`.
   - Si la réponse contient `{ "canceled": true }`, le serveur s'arrête.
   - « succeeded » signifie que le modèle est **déjà** servi par le serveur d'inférence sous `modelRef`. Callpme crée alors la version brouillon.

4. Le secret doit faire **32 caractères minimum**. Sinon, Callpme refuse tout.

Code côté Callpme : `src/lib/voices/inhouse/worker.ts`, et les routes `src/app/api/inhouse-training/`.

### B.3 Variables d'environnement (noms seulement, jamais de valeur dans le dépôt)

| Variable | Rôle | Sans elle |
|---|---|---|
| `CALLPME_TTS_URL` | Adresse du serveur d'inférence | Voix maison inactives, ElevenLabs partout |
| `CALLPME_TTS_API_KEY` | Jeton envoyé au serveur d'inférence | Pas d'en-tête d'authentification |
| `CALLPME_TRAINING_URL` | Adresse du serveur d'entraînement | Entraînements en attente (mode manuel possible) |
| `CALLPME_TRAINING_SECRET` | Secret partagé, 32+ caractères | Serveur d'entraînement refusé |

Le moteur vocal (`callpme-voix` sur Fly.io) a besoin de `CALLPME_TTS_URL` et `CALLPME_TTS_API_KEY`. L'application web Vercel a besoin des quatre variables.
