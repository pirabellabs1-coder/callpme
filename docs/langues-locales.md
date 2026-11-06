# Langues locales : ce qui est possible aujourd'hui

*Relevé du 6 novembre 2026. Tout ce qui est affirmé ici a été vérifié sur la page officielle citée, sauf mention **« non vérifié »**. Les prix sont en dollars US hors taxes, comme sur les sites des fournisseurs.*

## En une minute

| Langue | Au téléphone aujourd'hui ? | Ce qu'il faut |
|---|---|---|
| **Yoruba** | **Oui**, à tester avec des locuteurs | Une clé Spitch (voix) et une clé ElevenLabs (déjà là) ou Google (transcription) |
| **Haoussa** | **Oui**, à tester | Clé ElevenLabs (déjà là), Spitch en option |
| **Wolof** | **Oui, en mode bilingue** (wolof urbain + français) | Clé ElevenLabs (déjà là) |
| **Fon** | **Non** | Enregistrer des appels et entraîner nos propres modèles (voir § 6) |
| Éwé / Mina | Non | Idem ; voix éwé possible (Khaya), mais pas de transcription commerciale |
| Twi | Pas encore | Transcription seulement chez Intron (prix sur devis) ; voix Khaya sans streaming |
| Dendi, Bariba | Non | Aucun fournisseur au monde ; données à collecter |
| Bambara / Dioula | Non | Aucun fournisseur commercial ; à entraîner |

**La mauvaise nouvelle :** pour le **fon**, la langue la plus parlée au Bénin, aucun fournisseur ne propose ni transcription ni voix utilisables commercialement. Les modèles de Meta qui le couvrent (MMS) sont interdits d'usage commercial. Il faudra **construire** cette brique (§ 6).

**La bonne nouvelle :** le yoruba (parlé aussi dans l'est du Bénin), le haoussa et le wolof sont branchés dans le moteur. Ils s'activent dès que vous posez les clés et que vous les ouvrez (§ 8).

---

## 1. Comment marche un appel, et où la langue intervient

Un appel enchaîne trois briques :

1. **Transcription (STT)** : la voix de l'appelant devient du texte. Pour le français, c'est Deepgram.
2. **Cerveau (LLM)** : Claude lit le texte et écrit la réponse.
3. **Voix (TTS)** : le texte de la réponse redevient de la voix. Pour le français, c'est ElevenLabs Flash.

Une langue n'est utilisable que si **les trois briques** la gèrent. Le téléphone ajoute deux contraintes :

- **Audio 8 kHz.** Le réseau téléphonique transporte un son « étroit » (format G.711 µ-law, 8 000 échantillons par seconde). Les modèles sont surtout entraînés sur du 16 kHz : au téléphone, la reconnaissance est moins bonne qu'en démo. Aucun fournisseur ne publie ses scores à 8 kHz pour ces langues. **Il faudra mesurer nous-mêmes sur de vrais appels.**
- **Latence.** Une conversation paraît naturelle si l'agent répond en moins d'une seconde environ. En français, la transcription arrive *pendant* que l'appelant parle (streaming). Pour les langues locales, aucun fournisseur ne documente de streaming fiable. Le moteur détecte donc la fin de chaque phrase, puis l'envoie entière. Cela ajoute environ **0,5 à 1,5 seconde** par réponse (estimation, à mesurer).

---

## 2. Transcription (STT) : qui comprend quoi

| Fournisseur | Yoruba | Haoussa | Wolof | Fon | Éwé | Twi | Streaming pour ces langues | Prix |
|---|---|---|---|---|---|---|---|---|
| Deepgram (notre fournisseur actuel) | non | non | non | non | non | non | — | — |
| **Google Chirp 3** | oui `yo-NG` | oui `ha-NG` | oui `wo-SN` | non | non | non | oui (`StreamingRecognize`, mais 8 kHz non vérifié) | 0,016 $/min¹ |
| **ElevenLabs Scribe v2** | oui (25–50 % d'erreurs) | oui (10–20 % d'erreurs) | oui (25–50 %) | non | non | non | non vérifié | 0,22 $/heure (≈ 0,004 $/min) |
| **Spitch** (Nigeria) | oui | oui | non | non | non | non | non documenté | 0,00042 $/s (≈ 0,025 $/min) |
| Intron Sahara (Nigeria) | oui | oui | oui | non | non | oui | oui (WebSocket) | sur devis ; 3 appels simultanés max |
| AWS Transcribe | non | oui | oui | non | non | non | **non** (fichiers seulement) | — |
| Azure, AssemblyAI, OpenAI | partiel, qualité faible ou pas de streaming | | | non | non | non | — | — |
| Meta Omnilingual ASR (modèle ouvert) | oui | oui | oui | **oui** | oui | oui | non (morceaux de 40 s) | gratuit, à héberger ; **licence Apache 2.0 = commercial OK** |
| Meta MMS (modèle ouvert) | oui | oui | oui | oui | oui | oui | non | **licence non commerciale : interdit** |

¹ Tarif Google « Standard » V2. La page de prix ne nomme pas explicitement `chirp_3` (**non vérifié** : à confirmer sur la première facture).

Sources : [Google, langues](https://docs.cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages) · [Chirp 3](https://docs.cloud.google.com/speech-to-text/v2/docs/chirp_3-model) · [prix Google](https://cloud.google.com/speech-to-text/pricing) · [ElevenLabs STT](https://elevenlabs.io/docs/capabilities/speech-to-text) · [prix ElevenLabs](https://elevenlabs.io/pricing/api) · [Spitch](https://docs.spitch.app/features/transcription.md) · [prix Spitch](https://docs.spitch.app/concepts/pricing) · [Intron, langues](https://docs.voice.intron.io/docs/stt/supported-languages) · [Intron, streaming](https://docs.voice.intron.io/docs/stt/streaming) · [AWS](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html) · [Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt) · [Deepgram](https://developers.deepgram.com/docs/models-languages-overview) · [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr) · [MMS](https://huggingface.co/facebook/mms-1b-all)

**Pour le fon**, deux petits modèles ouverts existent : `chrisjay/fonxlsr` (14,97 % d'erreurs annoncés, audio 16 kHz) et `speechbrain/asr-wav2vec2-dvoice-fongbe`. Les deux sont sous licence Apache 2.0, donc l'usage commercial est autorisé. Ce sont de bonnes bases de départ, mais ils n'ont pas été testés sur du son téléphonique.

---

## 3. Voix (TTS) : qui parle quoi

| Fournisseur | Yoruba | Haoussa | Wolof | Fon | Éwé | Twi | Streaming | Sortie téléphone 8 kHz | Prix |
|---|---|---|---|---|---|---|---|---|---|
| ElevenLabs **Flash v2.5** (actuel) | non | non | non | non | non | non | oui | oui | 0,04 $ / 1 000 caractères |
| ElevenLabs **Eleven v3** | oui | oui | non | non | non | non | oui | oui | 0,08 $ / 1 000 car. |
| ElevenLabs **Eleven v4 Turbo** | non | oui | oui | non | non | non | oui | oui | 0,04 $ / 1 000 car. |
| **Spitch** | oui (Sade, Funmi, Segun, Femi) | oui (Amina, Zainab, Hasan, Aliyu) | non | non | non | non | oui | converti par notre moteur | 0,0014 $ par seconde de voix |
| Khaya (GhanaNLP) | oui | oui | oui | non | oui | oui | **non** (fichier entier) | converti | non publié |
| Azure, Google, AWS, Cartesia | non | non | non | non | non | non | — | — | — |
| Meta MMS-TTS (ouvert) | oui | oui | non | **oui** | oui | oui | non | — | **non commercial : interdit** |
| CONCREE Adia_TTS (wolof, ouvert) | — | — | oui | — | — | — | non (~20 s par phrase) | — | Apache 2.0 |

Sources : [modèles ElevenLabs](https://elevenlabs.io/docs/overview/models) · [API TTS ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-speech/stream) · [voix Spitch](https://docs.spitch.app/concepts/voices) · [API Spitch](https://docs.spitch.app/features/speech) · [Khaya](https://developer.khaya.ai/apis) · [Azure TTS](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) · [Google Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd) · [Polly](https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html) · [MMS-TTS fon](https://huggingface.co/facebook/mms-tts-fon) · [Adia_TTS](https://huggingface.co/CONCREE/Adia_TTS)

**Non vérifié, à tester au premier appel :**
- que les modèles `eleven_v3` et `eleven_v4_turbo` soient acceptés par l'API de streaming que nous utilisons. La doc d'ElevenLabs les annonce surtout pour son API « Text-to-Dialogue » ;
- la latence de Spitch, qui n'est pas publiée.

Si l'un des deux ne passe pas, il suffit de changer de modèle dans un réglage (`ELEVENLABS_MODEL_YO`, etc.), sans toucher au code.

---

## 4. Le cerveau : Claude comprend-il ces langues ?

Anthropic publie un tableau qui compare le niveau de Claude dans chaque langue à son niveau en anglais ([page officielle](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)). Le yoruba est la seule langue d'Afrique de l'Ouest qui y figure :

| Modèle | Yoruba | Français (pour comparer) |
|---|---|---|
| Haiku 5.5 (notre modèle par défaut) | **87 %** | 97,7 % |
| Sonnet 5.5 | 93,6 % | 98,7 % |
| Opus 5.5 | 96,3 % | 99,3 % |

C'est un test de connaissances en questions à choix multiples, pas une conversation orale : c'est un indice, pas une garantie.

Pour les autres langues, les études publiques ([IrokoBench](https://arxiv.org/html/2406.03368v2), [traduction FLORES](https://ar5iv.labs.arxiv.org/html/2309.07423)) donnent toutes le même classement :

1. le **haoussa** est le mieux compris ;
2. puis le **yoruba** ;
3. **twi, wolof, éwé** sont faibles ;
4. **fon, dioula** quasi inexistants. En traduction vers le fon, ChatGPT obtient un score de 3,9 sur 100 (71 en français) ;
5. **dendi, bariba, mina** n'apparaissent dans aucune étude.

Aucune étude ne mesure Claude 5.x sur ces langues : **il faudra des tests maison avec des locuteurs natifs**.

**Les tons et les accents.** En yoruba, les signes (ẹ, ọ, ṣ) et les tons changent le sens et la prononciation ([Orife 2018](https://www.isca-archive.org/interspeech_2018/orife18_interspeech.html)). Le moteur demande donc à Claude d'écrire avec tous les signes, pour que la voix prononce juste. En sens inverse, la transcription de l'appelant arrive souvent sans tons : l'agent est prévenu qu'elle peut être approximative.

**Traduire en passant par le français ?** Google Traduction (API Cloud) couvre le yoruba, le haoussa, l'éwé, le twi et le bambara. Il ne couvre **pas** le fon ni le wolof : ils sont dans l'application grand public, pas dans l'API ([liste](https://docs.cloud.google.com/translate/docs/languages)). Le modèle NLLB de Meta couvre le fon, mais sa licence interdit l'usage commercial ([fiche](https://huggingface.co/facebook/nllb-200-distilled-600M)). Je n'ai donc pas branché de traduction.

---

## 5. Le mode bilingue

À Cotonou comme à Lagos ou Dakar, on mélange souvent le français (ou l'anglais) et la langue locale dans la même phrase. Ce mélange est documenté pour le fongbé-français, le yoruba-anglais et le « wolof urbain ». Les meilleurs systèmes de transcription font encore environ 36 % d'erreurs sur ce genre de parole mélangée ([AfriSwitch](https://arxiv.org/abs/2608.26434)).

Le moteur propose donc un **mode bilingue** pour chaque langue locale :

- **Transcription.** ElevenLabs Scribe, sans langue imposée : il détecte la langue de chaque phrase.
- **Réponse.** Claude répond dans la langue de la dernière phrase de l'appelant.
  - Pour les langues où Claude est faible (wolof), il répond en français simple et ne garde de la langue locale que des formules sûres (salutations, politesse). Il a la consigne de ne jamais inventer de phrase.
- **Voix.** ElevenLabs uniquement, sans langue imposée, pour pouvoir dire le français *et* la langue locale. Spitch ne parle pas français.

Le mode bilingue est **imposé pour le wolof** et proposé en option pour le yoruba et le haoussa.

---

## 6. Recommandation langue par langue

### Disponible maintenant (après test)

- **Yoruba.**
  - Transcription : ElevenLabs Scribe (clé déjà en place) ou Google Chirp 3.
  - Voix : Spitch (voix nigérianes natives) ; sinon ElevenLabs v3.
  - Cerveau : **Sonnet conseillé** plutôt que Haiku.
- **Haoussa.**
  - Transcription : Scribe ou Google.
  - Voix : ElevenLabs v3 ou Spitch.
  - Cerveau : Haiku à tester ; c'est la langue la mieux comprise.
- **Wolof**, en mode bilingue seulement.
  - Transcription : Scribe ou Google.
  - Voix : ElevenLabs v4 Turbo, seul modèle qui parle wolof.

### Possible avec un partenaire

- **Twi.**
  - Transcription : Intron, le seul en temps réel. Prix sur devis, 3 appels simultanés : il faut négocier.
  - Voix : Khaya, phrase entière, sans streaming.
  - Cerveau : faible. Bilingue français/anglais seulement.
- **Éwé.** Voix possible avec Khaya, mais il n'existe aucune transcription commerciale : il faut entraîner un modèle (voir le fon).

### À construire : fon, mina, dendi, bariba, bambara/dioula

Il n'existe aucune offre commerciale. Le chemin réaliste :

1. **Collecter des données.**
   - **Transcription** : quelques dizaines d'heures d'appels réels en fon, transcrites par des locuteurs. Il faut le consentement des appelants : c'est une donnée personnelle.
   - **Voix** : 5 à 10 heures d'enregistrement studio d'un seul locuteur (estimation de faisabilité, non vérifiée).
2. **Entraîner la transcription**, en partant d'un modèle ouvert et commercial : Meta Omnilingual ASR (Apache 2.0, couvre déjà le fon, le dendi et le bariba) ou `fonxlsr`.
3. **Entraîner la voix** avec Piper/VITS (licences MIT ou GPL) ou Parler-TTS (Apache 2.0). **Pas** MMS, F5-TTS ni XTTS, dont les licences interdisent ou n'autorisent pas clairement l'usage commercial.
4. **Héberger** les deux modèles sur un serveur avec GPU, par exemple sur Fly.io à côté du serveur vocal.

Le moteur est déjà prêt à les recevoir : la transcription « phrase par phrase » accepte n'importe quel modèle qui prend un fichier audio.

5. **Le cerveau reste le point faible.** Claude ne parle pas fon. Même avec la voix et la transcription, l'agent devra répondre **en français** et ne glisser que des formules fon validées. C'est le mode bilingue. Pour aller plus loin, il faudrait un modèle de traduction fon↔français entraîné sur nos données. C'est un projet de plusieurs mois.

---

## 7. Coût par minute et marge

Hypothèses (voir `src/lib/costs/economics.ts`) :
- Un appel entrant sur un numéro français coûte 0,0144 $ par minute de téléphonie.
- Une minute d'appel contient 679 caractères de réponse de l'agent, soit environ **45 secondes de voix**. Cette durée est une estimation à 15 caractères par seconde, à mesurer.
- ElevenLabs est compté au prix prudent de l'abonnement : 0,083 $ pour 1 000 caractères en Flash ou v4 Turbo, 0,166 $ en v3, qui consomme deux fois plus de crédits.
- La transcription est comptée sur toute la durée de l'appel. C'est une estimation haute, puisqu'on n'envoie que les phrases de l'appelant.
- Les minutes incluses sont utilisées à 100 %, numéros et frais de paiement compris.
- Taux de change : 1 $ = 0,86 €.

| Scénario | Coût / min | Essentiel 19 € | Starter 49 € | Pro 149 € |
|---|---|---|---|---|
| **Français (référence actuelle)** | 0,067 € | 53 % | 59 % | 47 % |
| Yoruba économique (Scribe + Spitch + Haiku) | 0,071 € | 51 % | 57 % | **44 %** |
| Yoruba qualité (Google + Spitch + Sonnet) | 0,100 € | 36 % | 42 % | **25 %** ⚠️ |
| Yoruba/Haoussa via ElevenLabs v3 (+ Haiku) | 0,114 € | 29 % | 35 % | **15 %** ⚠️ |
| Wolof (Scribe + v4 Turbo + Haiku) | 0,065 € | 54 % | 60 % | 48 % |

**À retenir :**
- La combinaison **Scribe + Spitch + Haiku** garde la marge au-dessus de 40 % sur toutes les offres. **C'est le réglage par défaut du moteur pour le yoruba.**
- **Sonnet** et **ElevenLabs v3** font passer la marge sous 40 %. Sonnet est conseillé pour la qualité en yoruba, ElevenLabs v3 est la voix de secours. Pour les utiliser sans perdre de marge, il faut soit un **supplément « langue locale »**, soit moins de minutes incluses. **C'est à vous de décider.**
- Le compteur de coût réel de chaque appel connaît désormais ces fournisseurs : Spitch est facturé à la seconde de voix, v3 au double de Flash. Après les premiers appels, la page Rentabilité montrera les vrais chiffres.

---

## 8. Ce qui a été branché dans le moteur, et comment l'activer

- **Catalogue des langues.**
  - Fichier `src/lib/voice-engine/languages.ts`. Chaque langue a un statut honnête : « disponible » ou « bientôt ».
  - L'assistant de création grise les langues « bientôt ».
  - L'API refuse une langue locale qui n'est pas ouverte.
- **Fournisseurs par langue.** Fichiers `stt.ts` et `tts.ts`.
  - Le français ne change pas : Deepgram et ElevenLabs Flash.
  - Chaque fournisseur reste éteint tant que sa clé n'est pas posée.
- **Transcription phrase par phrase.** Fichier `stt-batch.ts`. Le moteur détecte lui-même début et fin de parole, ce qui permet d'utiliser n'importe quel fournisseur « par fichier ».
- **Consignes de langue et mode bilingue** dans le prompt de l'agent.

**Pour ouvrir le yoruba, par exemple :**

1. Sur le serveur vocal (Fly, app `callpme-voix`), posez les clés :
   - `SPITCH_API_KEY`, pour la voix yoruba ;
   - `ELEVENLABS_API_KEY`, déjà en place, qui suffit pour la transcription Scribe ;
   - en option, `GOOGLE_STT_CREDENTIALS` pour Google Chirp 3 : c'est le fichier JSON d'un compte de service, avec l'API Speech-to-Text activée.
2. Passez un appel de test en yoruba avec un locuteur natif. Vérifiez la compréhension, la voix et le délai de réponse.
3. Sur Vercel, ajoutez `yo-NG` à `NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES` (par exemple `yo-NG,ha-NG`), puis redéployez. La langue devient alors choisissable dans l'assistant.
   - Ce réglage n'est lu qu'au moment du déploiement : il faut redéployer après chaque modification.
   - Retirer une langue de la liste empêche de **modifier** les agents qui l'utilisent. Ils continuent de répondre au téléphone tant que les clés restent en place.

Réglages facultatifs :
- `VOICE_STT_YO=spitch` ou `google` force un fournisseur de transcription.
- `ELEVENLABS_MODEL_YO` change le modèle de voix ElevenLabs.
- `SPITCH_VOICE_YO=femi` change la voix Spitch.

---

## 9. Ce que vous devez décider ou acheter

1. **Clé Spitch** : à créer sur spitch.app, 1 $ de crédit offert pour tester. C'est la voix yoruba et haoussa la moins chère et la plus native.
2. **Compte Google Cloud** avec Speech-to-Text, en option : utile si Scribe se trompe trop en yoruba ou en haoussa.
3. **Tests avec des locuteurs natifs**, une demi-journée par langue : qualité de compréhension, voix, délai. Sans ce test, n'ouvrez pas la langue aux clients.
4. **Prix** : un supplément « langue locale », ou garder Haiku et Spitch pour rester au-dessus de 40 % de marge.
5. **Fon** : lancer ou non un projet de collecte de données (appels enregistrés avec consentement, plus un locuteur en studio) et d'entraînement. C'est le seul moyen d'avoir le fon : comptez plusieurs mois, du travail de transcription humaine et un serveur GPU.
6. **Intron**, si le twi ou le Ghana compte : demander un devis et plus de 3 appels simultanés.
