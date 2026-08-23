-- Positionnement en base (23/08/2026). Même motif que la roadmap en 00052 :
-- le contenu vivait en dur dans PositionnementPage.tsx, donc impossible à modifier
-- sans un déploiement — et hors de portée de l'assistant IA de l'accueil.
--
-- UNE table pour toute la page : les sections n'ont pas de vie propre, seulement
-- un rendu propre. `section` dit quoi rendre, `ordre` dans quel ordre.
-- `body`/`note` sont du MARKDOWN (react-markdown est déjà utilisé pour la fiche
-- argumentaire des leads) : c'est ce qui remplace les <span font-semibold> du TSX.
--
-- Le contenu inséré ici est repris MOT POUR MOT de la page du 22/08, elle-même
-- alignée sur POSITIONNEMENT.md (vault, 18/07/2026) et le panorama concurrentiel
-- du 18/07. La source de vérité reste le vault : si les deux divergent, c'est
-- cette table qu'on corrige.

CREATE TABLE IF NOT EXISTS public.positionnement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL CHECK (section IN (
    'intro',      -- chapeaux de section ; `title` = clé de la section visée
    'these',      -- la phrase de thèse (title) + son paragraphe (body)
    'phrase',     -- phrases prêtes à dire (slide, démo)
    'interdit',   -- vocabulaire banni ; `title` seul
    'citation',   -- verbatims terrain ; body = citation, note = ce qu'on en tire
    'boucle',     -- les 5 temps du produit ; `icon` = nom d'icône lucide
    'offre',      -- l'offre et les prix
    'argument',   -- les 3 arguments, dans l'ordre
    'concurrent', -- panorama ; segment + verdict
    'sacrifice'   -- ce qu'on ne fait PAS ; `title` seul
  )),
  ordre int NOT NULL DEFAULT 0,
  title text,
  body text,
  note text,
  icon text,      -- boucle : nom d'icône lucide-react (whitelistée côté front)
  segment text,   -- concurrent
  verdict text CHECK (verdict IN ('rouge', 'orange', 'vert')),
  style text NOT NULL DEFAULT 'plain' CHECK (style IN ('plain', 'card', 'accent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS positionnement_items_section_ordre_idx
  ON public.positionnement_items (section, ordre);

ALTER TABLE public.positionnement_items ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir).
CREATE POLICY positionnement_items_admin_all ON public.positionnement_items
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.positionnement_items FROM anon;

-- Realtime : l'assistant IA écrit dans cette table, la page doit se rafraîchir
-- sans rechargement. ⚠️ Sans cette ligne, un abonnement postgres_changes ne reçoit
-- rien EN SILENCE (c'est le cas de roadmap_items, dont le hook écoute dans le vide).
ALTER PUBLICATION supabase_realtime ADD TABLE public.positionnement_items;

-- Contenu de référence. Rejouable : ne s'insère que si la table est vide, donc
-- une modification faite depuis le dashboard ne sera jamais écrasée par un replay.
INSERT INTO public.positionnement_items (section, ordre, title, body, note, icon, segment, verdict, style)
SELECT * FROM (VALUES
  -- ── Chapeaux de section ────────────────────────────────────────────────────
  -- 1re ligne castée : dans un VALUES, un NULL nu reste de type `unknown` et la
  -- sous-requête ne sait pas résoudre les colonnes qui n'ont que des NULL.
  ('intro', 0, 'page', $$Qui on est, ce qu'on vend, contre qui. Source de vérité : POSITIONNEMENT.md (18/07/2026) — si un support contredit ce doc, c'est le support qui a tort.$$, NULL::text, NULL::text, NULL::text, NULL::text, 'plain'),
  ('intro', 1, 'citation', $$Pas notre auto-évaluation : les mots d'Antoaneta Petrache (référente Compagnons), CR des RDV de mai et du 13/07.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 2, 'boucle', $$L'architecture du produit ET du discours. Chaque temps isolé est imitable ; la boucle complète, non — et c'est ce que le national Compagnons exige.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 3, 'argument', $$La génération (quiz, fiches) et le reader sont gratuits ailleurs : on ne vend jamais les features, on vend le modèle et la preuve.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 4, 'argument_fin', $$Deux vocabulaires assumés : « toute la classe / accessible à tous » dans le récit de valeur ; « dys / DSA / RQTH / legge 170 » dans la couche financement et SEO, là où l'argent vit. Caution UDL/CAST : pour les gardiens (national, dossiers, jurys), jamais en slogan.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 5, 'concurrent', $$Panorama du 18/07/2026 (sources datées dans le vault). L'intersection accessibilité × apprentissage actif × collectif reste inoccupée : personne ne fait la boucle entière. Ne JAMAIS pitcher brique par brique — c'est perdre contre le spécialiste de chaque brique.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 6, 'sacrifice', $$Sacrifices assumés — ne pas re-litiger à chaque baisse de moral. Un positionnement qui ne renonce à rien n'est pas un positionnement.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('intro', 7, 'petrache', $$Notre force : les centres de formation artisanaux — dit par le terrain$$, NULL, NULL, NULL, NULL, 'plain'),

  -- ── La thèse ───────────────────────────────────────────────────────────────
  ('these', 0, $$MEMOVIA rend les cours accessibles à toute la classe, au lieu de donner un outil à part aux élèves en difficulté.$$,
   $$Construit pour les métiers qui se transmettent par l'oral et le geste. Les autres compensent l'élève (individuel, en aval, ~15 % de la classe) ; MEMOVIA rend accessible le cours lui-même (collectif, à la source, sans dossier ni étiquette, 100 % de la classe — y compris les dys jamais diagnostiqués, majoritaires).$$,
   NULL, NULL, NULL, NULL, 'plain'),

  ('phrase', 0, 'Phrase de slide / site', $$« Là où d'autres adaptent des documents pour l'élève dys, MEMOVIA rend l'enseignement accessible à toute la classe. »$$, NULL, NULL, NULL, NULL, 'card'),
  ('phrase', 1, 'Phrase de démo', $$« Le formateur capte son cours. MEMOVIA le rend accessible à toute la classe, et la progression est attestée à la fin. »$$, NULL, NULL, NULL, NULL, 'card'),

  -- ── Interdits ──────────────────────────────────────────────────────────────
  ('interdit', 0, $$« outil DYS »$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('interdit', 1, $$« solution de compensation »$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('interdit', 2, $$« reader »$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('interdit', 3, $$vendre la génération de fiches/quiz$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('interdit', 4, $$nommer Glaaster en public$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('interdit', 5, $$« 100 % pris en charge OPCO »$$, NULL, NULL, NULL, NULL, NULL, 'plain'),

  -- ── Verbatims terrain (Petrache) ───────────────────────────────────────────
  ('citation', 0, NULL,
   $$« Le grand public de cette plateforme, ça va être **les formateurs** » — « un vrai potentiel comme **outil d'animation de cours** ».$$,
   $$Le pivot espace formateur vient d'elle.$$, NULL, NULL, NULL, 'card'),
  ('citation', 1, NULL,
   $$Le podcast : « **les gens adorent ça** », « incroyable » — c'est ce qui aide les formateurs à se projeter. Et les carrossiers itinérants : formation neuve, zéro ressource pédagogique, des formateurs qui « **ont tout dans leur tête** » — MEMOVIA « leur plaît beaucoup ».$$,
   $$Exactement la thèse : les métiers qui se transmettent par l'oral et le geste.$$, NULL, NULL, NULL, 'card'),
  ('citation', 2, NULL,
   $$Sur la police dys : « je n'y crois pas beaucoup, **c'est partout maintenant** ». Ce qui vend chez les artisans : l'adaptation du contenu PAR le formateur — et la captation du geste et de la parole en atelier, jusqu'au possible **produit physique** (micro/boîtier, en exploration avec les formateurs).$$,
   $$C'est pour ça qu'on rétrograde les polices dys dans l'argumentaire.$$, NULL, NULL, NULL, 'card'),

  -- ── La boucle en 5 temps ───────────────────────────────────────────────────
  ('boucle', 0, 'Capter', $$Le formateur enregistre son cours au téléphone (audio ≤ 50 Mo) ou dépose son PDF/docx/pptx « sacré ».$$, NULL, 'Mic', NULL, NULL, 'card'),
  ('boucle', 1, 'Adapter', $$Lecture adaptée DYS (syllabes, lettres muettes, TTS karaoké, figures replacées), résumés par niveau (CAP → sup), fiches 6 formats — tout éditable par le formateur.$$, NULL, 'Wand2', NULL, NULL, 'card'),
  ('boucle', 2, 'Animer', $$Quiz Live en classe : 100 participants, code + QR, mode tableau.$$, NULL, 'Radio', NULL, NULL, 'card'),
  ('boucle', 3, 'Ancrer', $$Flashcards à répétition espacée réelle, quiz 4 types dont réponse libre corrigée par IA.$$, NULL, 'Repeat2', NULL, NULL, 'card'),
  ('boucle', 4, 'Attester', $$Progression par élève et par classe. ⚠️ Rapport exportable PAS livré — chantier produit n°1. On vend l'usage attesté, pas encore la progression.$$, NULL, 'BadgeCheck', NULL, NULL, 'card'),

  -- ── L'offre et les prix ────────────────────────────────────────────────────
  ('offre', 0, $$France — per-établissement, JAMAIS per-seat.$$,
   $$Pilote (1 site, 1 an, non renouvelable) 3 000 € · Site S (<150 apprenants) 6 000 €/an · **Site M (150-500) 12 000 €/an = cible par défaut** · Site L (>500) 20 000 €/an · réseau 12 000 € + 6 000 €/site, plafond 36 000 €. Formateurs et élèves illimités (l'argument tueur face au per-élève). Ne jamais citer le prix en premier. Toute remise est nommée, datée et à bascule écrite au contrat ; les 3 premières signatures = découverte de prix. 🔴 Ne pas publier cette grille tant qu'il n'y a qu'un client : devis uniquement.$$,
   NULL, NULL, NULL, NULL, 'plain'),
  ('offre', 1, $$La règle qui fixe le prix$$,
   $$(conseil du 22/08, unanimité) : la majoration RQTH finance TOUTE l'adaptation d'un apprenti, pas seulement un logiciel. Une ligne SaaS en capte 20 à 35 %, soit **~1 200 € par apprenti RQTH** — il en faut donc une dizaine pour porter un Site M. Première question de qualification : « combien d'apprentis RQTH avez-vous déclarés cette année ? ». ⚠️ Plafond réseau à 36 000 € délibéré : au-delà de 40 000 € HT, un CFA porté par une CCI ou une CMA sort de la dispense de procédure et déclenche une mise en concurrence.$$,
   NULL, NULL, NULL, NULL, 'accent'),
  ('offre', 2, $$Le taux RQTH n'est pas une inconnue, il est sourcé$$,
   $$: DARES (publié 27/02/2026) — 18 800 contrats d'apprentissage signés par des travailleurs handicapés en 2025, **soit 2 % des nouveaux contrats**. À 2 %, un site de 500 apprenants porte ~10 dossiers, ce qui valide le Site M à 12 000 €. Un site de 150, borne basse de la même tranche, n'en porte que 3, soit ~3 600 € défendables. 🔑 **La grille tient par le HAUT de chaque tranche** : un CFA de 200 apprenants avec 4 RQTH n'est pas un deal à 12 000 €, c'est un pilote. C'est la question de qualification qui tranche, pas la tranche d'effectif. ⚠️ Deux réserves : 2 % est un flux d'entrées 2025, pas un stock, et c'est une moyenne nationale — les CFA dont le référent handicap est assez engagé pour acheter sont mécaniquement au-dessus.$$,
   NULL, NULL, NULL, NULL, 'card'),
  ('offre', 3, $$Compagnons, renégociation de la rentrée$$,
   $$: 🔴 ne PAS renégocier en licences — ça ratifierait le per-seat comme terme de référence de notre unique contrat signé, et chaque CFA suivant l'exigerait. On vend le site de Toulouse (~600 apprentis = palier L, 20 000 €) avec une remise nommée « programme de référence » qui atterrit à 12 000 €. Ce nombre ne se négocie pas : 200 licences × 60 € = 12 000 €, exactement ce qu'ils avaient déjà budgété. 🔑 Le vrai blocage n'est pas le prix : le référent handicap ne fait pas de ROI, il lui faut la pièce à classer (apprenti nommé, période, séances). L'export d'attestation d'usage débloque chaque euro au-dessus de 12 000 €.$$,
   NULL, NULL, NULL, NULL, 'accent'),
  ('offre', 4, $$Italie — Paidea revend$$,
   $$(marge par-dessus le prix) : listino S/M/L 490 / 990 / 1 690 €/an par école, 990 = tarif recommandé, Docente 129 €. Prezzo riservato −30 %, plancher −35 % early-bird. ⚠️ Plafond TTS sur le 490.$$,
   NULL, NULL, NULL, NULL, 'plain'),
  ('offre', 5, $$B2C$$, $$: self-serve Stripe existant, laisser-vivre, non poussé.$$, NULL, NULL, NULL, NULL, 'plain'),
  ('offre', 6, $$Financements à mettre en face du prix$$,
   $$: FR = majoration OPCO jusqu'à ~4 000 €/an par apprenti RQTH versés au CFA, dont le logiciel ne capte que 20-35 % (décideur : le référent handicap) + plan de développement des compétences. IT = legge 170 + fonds écoles via MEPA. ⚠️ Jamais promettre « 100 % pris en charge ».$$,
   NULL, NULL, NULL, NULL, 'accent'),

  -- ── Les 3 arguments ────────────────────────────────────────────────────────
  ('argument', 0, $$1 · On transforme VOTRE cours, fidèlement$$,
   $$Pas une version régénérée à côté : le support réel du formateur rendu accessible (figures ancrées, extraction de PDF durs, sortie DOCX/PPTX en Luciole). Le seul vrai moat technique. Rétrograder les polices dys (« c'est partout ») .$$,
   NULL, NULL, NULL, NULL, 'card'),
  ('argument', 1, $$2 · Une fois, pour toute la classe — et c'est finançable$$,
   $$Zéro travail en plus ET un artefact que l'établissement oppose à son financeur/audit. Les gratuits US ne sont branchés ni à OPCO/RQTH/Qualiopi ni à la legge 170. Le gratuit ne fait pas rembourser.$$,
   NULL, NULL, NULL, NULL, 'card'),
  ('argument', 2, $$3 · L'usage attesté aujourd'hui, la progression demain$$,
   $$Qui a utilisé le cours adapté, combien. La « preuve de progression » attendra le rapport exportable. Preuve sociale factuelle : « en pilote chez les Compagnons du Devoir ».$$,
   NULL, NULL, NULL, NULL, 'card'),

  -- ── Concurrents (panorama du 18/07, verdicts d'origine conservés) ──────────
  ('concurrent', 0, 'Glaaster',
   $$Adaptation de documents par profil cognitif, TTS 5 langues, offre School (console admin, mode examen, LTI Ypareo/Moodle).$$,
   $$Caution scientifique CNRS/INSERM, notoriété dys, School packagée. Ne fait ni création prof, ni quiz live, ni SRS, ni import audio.$$,
   NULL, 'Accessibilité FR', 'rouge', 'plain'),
  ('concurrent', 1, 'Nolej',
   $$PDF/Word/audio/vidéo → quiz, flashcards, activités ; export H5P/SCORM + Moodle LTI.$$,
   $$L'overlap le plus direct sur Capter → Adapter. Mais cible les ingénieurs pédago outillés LMS ; zéro accessibilité, zéro espace élève, zéro live.$$,
   NULL, 'Outils formateur FR', 'rouge', 'plain'),
  ('concurrent', 2, 'NotebookLM (Google)',
   $$Sources → chat sourcé, podcasts FR, Video Overviews. Gratuit.$$,
   $$Commoditise résumés/podcast/chat. Verrou : compte Google requis → interdit avec des élèves en classe. C'est LA brèche B2B.$$,
   NULL, 'B2C gratuit', 'rouge', 'plain'),
  ('concurrent', 3, 'ChatGPT / Gemini',
   $$Déjà dans la poche des apprentis et des profs.$$,
   $$L'objection n°1 en démo. Réponse : cadre établissement, données, profils classe, preuve — jamais la génération.$$,
   NULL, 'B2C gratuit', 'rouge', 'plain'),
  ('concurrent', 4, 'Algor Education',
   $$Cartes mentales/flashcards/quiz IA « né pour l'inclusion DSA », spin-off Politecnico di Torino.$$,
   $$Canal revendeur Campustore en place, fonds PNRR, SEO massif sur « mappe concettuali DSA ». Mais outil d'étude individuel — pas la lezione rendue accessible à toute la classe.$$,
   NULL, 'Italie', 'rouge', 'plain'),
  ('concurrent', 5, 'Cantoo Scribe',
   $$Cartable numérique dys : production écrite, maths, mode examen. Déployé sur MonLycée.net.$$,
   $$Distribution institutionnelle, licences profs gratuites. Poste de travail de l'élève, pas l'enseignement — mais son prix étab. calibre le marché FR.$$,
   NULL, 'Accessibilité FR', 'orange', 'plain'),
  ('concurrent', 6, 'Wooclap / Quiz Wizard',
   $$Quiz et sondages live + générateur IA de QCM.$$,
   $$Possède « Animer » dans le sup. Notre quiz live ne vaut que branché sur le cours capté et adapté.$$,
   NULL, 'Outils formateur', 'orange', 'plain'),
  ('concurrent', 7, 'Dinobot',
   $$Tuteur IA via ENT/GAR, quiz depuis PDF.$$,
   $$Vraie machine de distribution ENT, même prix étab. que nous. Zéro accessibilité (vérifié de l'intérieur, 02/07).$$,
   NULL, 'K-12 FR', 'orange', 'plain'),
  ('concurrent', 8, 'Knowunity',
   $$Coach scolaire IA, 30 M d'étudiants revendiqués.$$,
   $$Rafle le B2C collège/lycée — confirme qu'on ne vend pas aux élèves.$$,
   NULL, 'B2C', 'orange', 'plain'),
  ('concurrent', 9, 'Anastasis',
   $$Incumbent historique des strumenti compensativi (ePico!, SuperMappe).$$,
   $$La référence culturelle « compensation » en Italie. Pas d'IA générative de contenu.$$,
   NULL, 'Italie', 'orange', 'plain'),
  ('concurrent', 10, 'MOBiDYS / Sondo',
   $$Bibliothèque de titres pré-adaptés (FROG) via ENT.$$,
   $$Contenu édité (littérature/manuels), pas les supports du formateur — autre métier.$$,
   NULL, 'Accessibilité FR', 'vert', 'plain'),

  -- ── Ce qu'on ne fait PAS ───────────────────────────────────────────────────
  ('sacrifice', 0, $$Pas de B2C marketing (SEO dys FR, Insta/TikTok, Meta Ads = terrain Glaaster)$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('sacrifice', 1, $$Pas de K-12 généraliste$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('sacrifice', 2, $$Pas de guerre de prix à 9,99 €$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('sacrifice', 3, $$Pas de formation live / ateliers récurrents / vente terrain$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('sacrifice', 4, $$Pas de course aux features reader (parité acquise)$$, NULL, NULL, NULL, NULL, NULL, 'plain'),
  ('sacrifice', 5, $$Pas de LTI/dev Ypareo ce trimestre$$, NULL, NULL, NULL, NULL, NULL, 'plain')
) AS seed(section, ordre, title, body, note, icon, segment, verdict, style)
WHERE NOT EXISTS (SELECT 1 FROM public.positionnement_items);
