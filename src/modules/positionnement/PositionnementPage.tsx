import { motion } from 'framer-motion'
import { Mic, Wand2, Radio, Repeat2, BadgeCheck, ShieldAlert, CalendarClock, Hammer, Map, PhoneCall } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/motion'

/**
 * Positionnement (22/08/2026) — l'armurerie commerciale, alignée mot pour mot
 * sur POSITIONNEMENT.md du vault (source de vérité, 18/07/2026) et le panorama
 * concurrentiel du 18/07. Si cette page contredit le doc du vault, c'est la
 * page qui a tort : mettre à jour le vault d'abord, puis recopier ici.
 */

const BOUCLE = [
  { icon: Mic, t: 'Capter', d: 'Le formateur enregistre son cours au téléphone (audio ≤ 50 Mo) ou dépose son PDF/docx/pptx « sacré ».' },
  { icon: Wand2, t: 'Adapter', d: 'Lecture adaptée DYS (syllabes, lettres muettes, TTS karaoké, figures replacées), résumés par niveau (CAP → sup), fiches 6 formats — tout éditable par le formateur.' },
  { icon: Radio, t: 'Animer', d: 'Quiz Live en classe : 100 participants, code + QR, mode tableau.' },
  { icon: Repeat2, t: 'Ancrer', d: 'Flashcards à répétition espacée réelle, quiz 4 types dont réponse libre corrigée par IA.' },
  { icon: BadgeCheck, t: 'Attester', d: 'Progression par élève et par classe. ⚠️ Rapport exportable PAS livré — chantier produit n°1. On vend l’usage attesté, pas encore la progression.' },
]

const ARGUMENTS_ORDRE = [
  {
    t: '1 · On transforme VOTRE cours, fidèlement',
    d: 'Pas une version régénérée à côté : le support réel du formateur rendu accessible (figures ancrées, extraction de PDF durs, sortie DOCX/PPTX en Luciole). Le seul vrai moat technique. Rétrograder les polices dys (« c’est partout ») .',
  },
  {
    t: '2 · Une fois, pour toute la classe — et c’est finançable',
    d: 'Zéro travail en plus ET un artefact que l’établissement oppose à son financeur/audit. Les gratuits US ne sont branchés ni à OPCO/RQTH/Qualiopi ni à la legge 170. Le gratuit ne fait pas rembourser.',
  },
  {
    t: '3 · L’usage attesté aujourd’hui, la progression demain',
    d: 'Qui a utilisé le cours adapté, combien. La « preuve de progression » attendra le rapport exportable. Preuve sociale factuelle : « en pilote chez les Compagnons du Devoir ».',
  },
]

type Verdict = 'rouge' | 'orange' | 'vert'
const VERDICT_STYLE: Record<Verdict, { dot: string; label: string }> = {
  rouge: { dot: '#B91C1C', label: 'Menace directe' },
  orange: { dot: '#B45309', label: 'Menace sur un segment' },
  vert: { dot: '#15803D', label: 'Pas une menace réelle' },
}

interface Concurrent {
  nom: string
  segment: string
  fait: string
  fort: string
  verdict: Verdict
}

// Source : panorama-concurrents-2026-07-18.md (vault). Verdicts d'origine conservés.
const CONCURRENTS: Concurrent[] = [
  { nom: 'Glaaster', segment: 'Accessibilité FR', fait: 'Adaptation de documents par profil cognitif, TTS 5 langues, offre School (console admin, mode examen, LTI Ypareo/Moodle).', fort: 'Caution scientifique CNRS/INSERM, notoriété dys, School packagée. Ne fait ni création prof, ni quiz live, ni SRS, ni import audio.', verdict: 'rouge' },
  { nom: 'Nolej', segment: 'Outils formateur FR', fait: 'PDF/Word/audio/vidéo → quiz, flashcards, activités ; export H5P/SCORM + Moodle LTI.', fort: 'L’overlap le plus direct sur Capter → Adapter. Mais cible les ingénieurs pédago outillés LMS ; zéro accessibilité, zéro espace élève, zéro live.', verdict: 'rouge' },
  { nom: 'NotebookLM (Google)', segment: 'B2C gratuit', fait: 'Sources → chat sourcé, podcasts FR, Video Overviews. Gratuit.', fort: 'Commoditise résumés/podcast/chat. Verrou : compte Google requis → interdit avec des élèves en classe. C’est LA brèche B2B.', verdict: 'rouge' },
  { nom: 'ChatGPT / Gemini', segment: 'B2C gratuit', fait: 'Déjà dans la poche des apprentis et des profs.', fort: 'L’objection n°1 en démo. Réponse : cadre établissement, données, profils classe, preuve — jamais la génération.', verdict: 'rouge' },
  { nom: 'Algor Education', segment: 'Italie', fait: 'Cartes mentales/flashcards/quiz IA « né pour l’inclusion DSA », spin-off Politecnico di Torino.', fort: 'Canal revendeur Campustore en place, fonds PNRR, SEO massif sur « mappe concettuali DSA ». Mais outil d’étude individuel — pas la lezione rendue accessible à toute la classe.', verdict: 'rouge' },
  { nom: 'Cantoo Scribe', segment: 'Accessibilité FR', fait: 'Cartable numérique dys : production écrite, maths, mode examen. Déployé sur MonLycée.net.', fort: 'Distribution institutionnelle, licences profs gratuites. Poste de travail de l’élève, pas l’enseignement — mais son prix étab. calibre le marché FR.', verdict: 'orange' },
  { nom: 'Wooclap / Quiz Wizard', segment: 'Outils formateur', fait: 'Quiz et sondages live + générateur IA de QCM.', fort: 'Possède « Animer » dans le sup. Notre quiz live ne vaut que branché sur le cours capté et adapté.', verdict: 'orange' },
  { nom: 'Dinobot', segment: 'K-12 FR', fait: 'Tuteur IA via ENT/GAR, quiz depuis PDF.', fort: 'Vraie machine de distribution ENT, même prix étab. que nous. Zéro accessibilité (vérifié de l’intérieur, 02/07).', verdict: 'orange' },
  { nom: 'Knowunity', segment: 'B2C', fait: 'Coach scolaire IA, 30 M d’étudiants revendiqués.', fort: 'Rafle le B2C collège/lycée — confirme qu’on ne vend pas aux élèves.', verdict: 'orange' },
  { nom: 'Anastasis', segment: 'Italie', fait: 'Incumbent historique des strumenti compensativi (ePico!, SuperMappe).', fort: 'La référence culturelle « compensation » en Italie. Pas d’IA générative de contenu.', verdict: 'orange' },
  { nom: 'MOBiDYS / Sondo', segment: 'Accessibilité FR', fait: 'Bibliothèque de titres pré-adaptés (FROG) via ENT.', fort: 'Contenu édité (littérature/manuels), pas les supports du formateur — autre métier.', verdict: 'vert' },
]

// ── Trame RDV Petrache 24/08 — source : compagnons-rdv-2026-08-24-prep.md
//    (vault, 20/08) + note manuscrite de Naoufel (photo 22/08) ────────────────
const TRAME_RDV = [
  { t: 'Montrer la plateforme et les nouveautés', d: 'Démo voix de lecture (Vivienne + suivi mot à mot sur le PDF d’origine — sa demande n°1 du 13/07, elle ne l’a jamais vue) + la vue admin de suivi. Sur un vrai document Compagnons. Annoncer sans s’excuser : invitations Microsoft réglées.' },
  { t: 'Comment on procède avec la démo réelle', d: 'Avec les formateurs : phase de test 4-5 formateurs moteurs multi-métiers, retours centralisés via elle. Question douce : « Avez-vous pu le tester en cours avec un formateur ? » + la date de l’atelier de rentrée (poser les 3 essais audio en conditions d’atelier comme première brique).' },
  { t: 'OPCO / RQTH — une question, pas un argument', d: 'De quel OPCO dépendent-ils ? La majoration RQTH (~4 000 €/an par apprenti versée au CFA) peut-elle financer une licence établissement ? Le dossier de cumul n’est pas instruit : on pose la question, on ne martèle pas.' },
  { t: 'Le modèle pédagogique', d: 'La boucle en 5 temps (Capter → Adapter → Animer → Ancrer → Attester). Attester = ce que le national veut voir.' },
  { t: 'Les carrossiers itinérants', d: 'Le point d’entrée le plus concret : formation neuve, zéro ressource pédagogique, formateurs qui « ont tout dans leur tête ». Question : on avance comment, concrètement, avec eux ?' },
  { t: 'Captation d’atelier — question ouverte', d: 'Micro ou boîtier connecté : à explorer AVEC les formateurs, jamais à vendre (elle avait écarté le boîtier). Proposer d’abord les 3 essais audio en conditions réelles (bruit, jargon) — fragilité connue : iOS coupe l’enregistrement web à l’écran verrouillé.' },
  { t: 'Handitech — la présenter comme une preuve', d: 'Objectif n°1 du RDV : repartir avec l’accord écrit sur la phrase « en pilote dans un CFA du réseau des Compagnons » + le feu vert pour 3 phrases de Florence Lhote. Formule : « Je vous envoie la phrase exacte par mail ce soir, un simple OK me suffit. »' },
]

const RDV_INTERDITS = [
  'Ne rien promettre (« une lecture comme le podcast ») : on montre',
  'Jamais de comparatif à charge sur Glaaster',
  'Pas de chiffre improvisé — grille par mail avec la phrase pilote',
  'Jamais « conforme RGAA » (déclaration en cours)',
  'Leurs documents ne vont jamais chez un concurrent',
]

// ── Roadmap — ce qu'on veut intégrer et POURQUOI ─────────────────────────────
type RoadStatus = 'en cours' | 'à trancher lundi' | '2 temps' | 'exploration' | 'parqué'
const ROAD_STATUS_STYLE: Record<RoadStatus, { bg: string; fg: string }> = {
  'en cours': { bg: 'rgba(124,58,237,0.12)', fg: '#6D28D9' },
  'à trancher lundi': { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  '2 temps': { bg: 'var(--accent-blue-bg)', fg: 'var(--accent-blue)' },
  exploration: { bg: 'rgba(180,83,9,0.12)', fg: '#92400E' },
  parqué: { bg: 'var(--bg-primary)', fg: 'var(--text-secondary)' },
}
const ROADMAP: { t: string; status: RoadStatus; pourquoi: string }[] = [
  { t: 'Rapport de progression exportable', status: 'en cours', pourquoi: 'Le chantier produit n°1. « Attester » est le temps de la boucle que le national Compagnons veut voir — sans lui on vend l’usage, pas la preuve. C’est lui qui débloque « la preuve, pas la promesse ».' },
  { t: 'Accès de supervision (la référente voit les cours générés)', status: 'à trancher lundi', pourquoi: 'Promis à Petrache, jamais livré. Lundi on lui présente les deux briques suivantes et C’EST ELLE qui priorise : supervision OU confort de lecture persistant.' },
  { t: 'Confort de lecture persistant (réglages mémorisés)', status: 'à trancher lundi', pourquoi: 'L’autre option du choix de lundi : l’apprenti retrouve SES réglages d’accessibilité à chaque cours, sans reconfigurer.' },
  { t: 'WhatsApp — temps 1 : notifications', status: '2 temps', pourquoi: 'Verbatim terrain (réunion 13/07) : « les jeunes ne lisent jamais leurs mails, tout passe par WhatsApp » — y compris les cours entre formateurs et apprentis. Temps 1 : rappels de révision (répétition espacée) et « ton cours adapté est prêt » directement sur WhatsApp.' },
  { t: 'WhatsApp — temps 2 : le cours dans la poche', status: '2 temps', pourquoi: 'Une fois le canal ouvert : accéder au cours adapté et réviser (flashcards, quiz) depuis WhatsApp, sans installer d’app. Faisabilité étudiée le 22/08 ; le temps 2 ne part que si le temps 1 prouve l’usage.' },
  { t: 'Éditer le texte du PDF (images préservées)', status: 'en cours', pourquoi: 'LE besoin central de Petrache : leurs PDF officiels sont figés — rendre le texte éditable (simplifier, alléger pour une classe faible) en laissant les images/plans intacts.' },
  { t: 'Boîtier / micro de captation d’atelier (produit physique)', status: 'exploration', pourquoi: 'En atelier, le formateur a les mains prises et iOS coupe l’enregistrement web à l’écran verrouillé : 2 h de cours en poche, ça casse. Un matériel dédié règle ça — mais Petrache avait écarté le boîtier : on explore avec les formateurs (3 essais audio d’abord), on ne vend rien. Matériel parqué tant que les essais n’ont pas parlé.' },
  { t: 'Import Netypareo / export SCORM', status: 'parqué', pourquoi: 'Demandé en réunion 13/07 (SCORM déjà en test). Pas ce trimestre : une demande de référencement par email, c’est tout — le temps fondateur va au rapport de progression.' },
]

// ── Canal prescripteurs — appel Christelle 19-20/08 ──────────────────────────
const CHRISTELLE_POINTS = [
  { t: '« 100 % financé OPCO » : interdit', d: 'Verbatim : « tu ne peux pas dire que c’est une solution 100 % financée par l’OPCO, ça dépend des OPCO, du profil de l’école ». Le discours commercial ne l’utilise jamais.' },
  { t: 'Les rails de financement, vus du terrain', d: 'Salarié RQTH → AGEFIPH / Cap Emploi (dossier monté AVANT, « ils payent, franchement »). Scolaire/alternance → MDPH (« gros budgets »). ⚠️ Son monde = formation continue, pas CFA : notre rail apprentissage (majoration RQTH versée au CFA) reste à trancher sur source primaire.' },
  { t: 'Le circuit d’achat', d: 'Le CFA connaît son public et monte les dossiers par personne ; NOUS on fournit le devis, la démarche est chez eux.' },
  { t: 'Les non-diagnostiqués : confirmé massivement', d: 'Handicaps invisibles, filles sous le radar, parents qui ne suivent pas. Le discours « toute la classe sur la même base, sans repérage » lui parle fortement.' },
  { t: 'Sa stratégie : le réseau de prescripteurs', d: 'Verbatim : « construire un réseau d’acteurs du handicap qui peuvent devenir prescripteurs de ta solution ». Le milieu est très fermé ; ceux qui font bouger les choses = les assos PARENTALES (légitimité + tous les filons de financement).' },
]
const CHRISTELLE_CONTACTS = [
  { nom: 'Benoit Charbonnier', role: 'Trésorier FUSO France (vérifié 20/08) — père de jumelles DYS', action: 'PREMIÈRE ACTION : Naoufel l’appelle en se recommandant de Christelle (script d’intro dans le CR vault). 06 58 61 90 46 · benoit.charbonnier@fusofrance.org (coordonnées de 2023, déjà revérifiées côté CA).' },
  { nom: 'FUSO France', role: 'Asso parentale (Perpignan) — cartable numérique MyFUSO ~1 000 € pour enfants DYS/TDAH', action: 'Modèle retenu : ils testent et parlent de nous. (Préinstall sur leurs PC = décliné, c’est du per-seat.)' },
  { nom: 'Dys-Positif · Le Cartable Fantastique', role: 'Assos DYS « qui ont du pouvoir et du réseau »', action: 'À approcher — Christelle envoie d’autres noms.' },
  { nom: 'Son contact MDPH / écoles', role: 'Financement côté écoles', action: 'Elle revient vers nous — relance douce si silence sous ~1 semaine.' },
  { nom: 'AMI Agefiph Handinnov', role: 'Appel à manifestation orienté innovation (envoyé par elle le 20/08)', action: 'Option : vague du 1er décembre en « expérimentation » avec les données Compagnons. On ne fonce pas.' },
]

const SACRIFICES = [
  'Pas de B2C marketing (SEO dys FR, Insta/TikTok, Meta Ads = terrain Glaaster)',
  'Pas de K-12 généraliste',
  'Pas de guerre de prix à 9,99 €',
  'Pas de formation live / ateliers récurrents / vente terrain',
  'Pas de course aux features reader (parité acquise)',
  'Pas de LTI/dev Ypareo ce trimestre',
]

const INTERDITS = ['« outil DYS »', '« solution de compensation »', '« reader »', 'vendre la génération de fiches/quiz', 'nommer Glaaster en public', '« 100 % pris en charge OPCO »']

export default function PositionnementPage() {
  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="show">
      <motion.header variants={staggerItem}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Positionnement</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Qui on est, ce qu'on vend, contre qui. Source de vérité : POSITIONNEMENT.md (18/07/2026) — si un support contredit ce doc, c'est le support qui a tort.
        </p>
      </motion.header>

      {/* ── RDV lundi — préparation (contenu daté, à retirer après le RDV) ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--memovia-violet)]/30 bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--memovia-violet)]" aria-hidden />
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">
            RDV lundi 24/08, 14h30 — Antoaneta Petrache
          </h2>
          <span className="rounded-full bg-[rgba(124,58,237,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#6D28D9]">
            sur site · 28 rue des Pyrénées · Emir en Teams sur l'ordi de Naoufel
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Objectif n°1 : repartir avec l'accord écrit sur la phrase pilote + le feu vert Florence Lhote — c'est ce qui débloque la vidéo Handitech (dépôt 1/09 23h59). ⚠️ Même jour 12h : point UES en visio.
        </p>
        <ol className="mt-3 grid gap-2 lg:grid-cols-2">
          {TRAME_RDV.map((s, i) => (
            <li key={s.t} className="rounded-xl bg-[var(--bg-primary)] p-3">
              <p className="text-[13px] font-bold text-[var(--text-primary)]">
                <span className="tabular-nums text-[var(--text-muted)]">{i + 1} · </span>{s.t}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-xl bg-[rgba(124,58,237,0.06)] p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#6D28D9]">C'est quoi, Handitech ?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Le <span className="font-semibold text-[var(--text-primary)]">Handitech Trophy</span> est le concours national
            handicap + technologie porté par Bpifrance et l'Agefiph : il récompense les innovations pour l'inclusion des
            personnes en situation de handicap (visibilité nationale, réseau de financeurs, crédibilité institutionnelle).
            Notre dossier est déjà complet en ligne — il ne manque que la vidéo (&lt; 1 min 30), tournée juste après ce RDV.
            Dépôt le 1/09, jury 14-15/09, finale à Paris si retenu (cérémonie 16/11).{' '}
            <span className="font-semibold text-[var(--text-primary)]">Face à Petrache</span> : Handitech se présente comme
            une preuve de recul externe qui LA sert face au national (« logique de test en région »), jamais comme une
            accélération commerciale — et c'est l'occasion de demander comment les Compagnons peuvent nous accompagner.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
          <span className="mr-1 text-[12px] font-semibold text-[var(--danger)]">Interdits du RDV :</span>
          {RDV_INTERDITS.map((i) => (
            <span key={i} className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]">
              {i}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── La thèse ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-[var(--shadow-xs)]"
      >
        <p className="font-display max-w-[36ch] text-[26px] font-bold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[30px]">
          MEMOVIA rend les cours accessibles à toute la classe, au lieu de donner un outil à part aux élèves en difficulté.
        </p>
        <p className="mt-2 max-w-[75ch] text-[14px] text-[var(--text-secondary)]">
          Construit pour les métiers qui se transmettent par l'oral et le geste. Les autres compensent l'élève
          (individuel, en aval, ~15 % de la classe) ; MEMOVIA rend accessible le cours lui-même (collectif, à la
          source, sans dossier ni étiquette, 100 % de la classe — y compris les dys jamais diagnostiqués, majoritaires).
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl bg-[var(--bg-primary)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Phrase de slide / site</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-primary)]">
              « Là où d'autres adaptent des documents pour l'élève dys, MEMOVIA rend l'enseignement accessible à toute la classe. »
            </p>
          </div>
          <div className="rounded-xl bg-[var(--bg-primary)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Phrase de démo</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-primary)]">
              « Le formateur capte son cours. MEMOVIA le rend accessible à toute la classe, et la progression est attestée à la fin. »
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
          <span className="mr-1 text-[12px] font-semibold text-[var(--danger)]">Interdits :</span>
          {INTERDITS.map((i) => (
            <span key={i} className="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]">
              {i}
            </span>
          ))}
        </div>
      </motion.section>

      {/* ── La force terrain (ce que Petrache dit de nous) ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-[var(--memovia-violet)]" aria-hidden />
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">
            Notre force : les centres de formation artisanaux — dit par le terrain
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Pas notre auto-évaluation : les mots d'Antoaneta Petrache (référente Compagnons), CR des RDV de mai et du 13/07.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <blockquote className="rounded-xl bg-[var(--bg-primary)] p-3.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
            « Le grand public de cette plateforme, ça va être <span className="font-semibold">les formateurs</span> » —
            « un vrai potentiel comme <span className="font-semibold">outil d'animation de cours</span> ».
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">Le pivot espace formateur vient d'elle.</span>
          </blockquote>
          <blockquote className="rounded-xl bg-[var(--bg-primary)] p-3.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
            Le podcast : « <span className="font-semibold">les gens adorent ça</span> », « incroyable » — c'est ce qui aide
            les formateurs à se projeter. Et les carrossiers itinérants : formation neuve, zéro ressource pédagogique,
            des formateurs qui « <span className="font-semibold">ont tout dans leur tête</span> » — MEMOVIA « leur plaît beaucoup ».
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">Exactement la thèse : les métiers qui se transmettent par l'oral et le geste.</span>
          </blockquote>
          <blockquote className="rounded-xl bg-[var(--bg-primary)] p-3.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
            Sur la police dys : « je n'y crois pas beaucoup, <span className="font-semibold">c'est partout maintenant</span> ».
            Ce qui vend chez les artisans : l'adaptation du contenu PAR le formateur — et la captation du geste et de la
            parole en atelier, jusqu'au possible <span className="font-semibold">produit physique</span> (micro/boîtier, en exploration avec les formateurs).
            <span className="mt-1 block text-[11px] text-[var(--text-muted)]">C'est pour ça qu'on rétrograde les polices dys dans l'argumentaire.</span>
          </blockquote>
        </div>
      </motion.section>

      {/* ── La boucle en 5 temps (= le produit construit) ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">La boucle en 5 temps</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
          L'architecture du produit ET du discours. Chaque temps isolé est imitable ; la boucle complète, non — et c'est ce que le national Compagnons exige.
        </p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {BOUCLE.map((b, i) => (
            <li key={b.t} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(124,58,237,0.12)] text-[#6D28D9]" aria-hidden>
                  <b.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-bold text-[var(--text-primary)]">
                  <span className="tabular-nums text-[var(--text-muted)]">{i + 1} · </span>{b.t}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">{b.d}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* ── L'offre ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <motion.section
          variants={staggerItem}
          className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">L'offre et les prix</h2>
          <ul className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            <li>
              <span className="font-semibold text-[var(--text-primary)]">France — per-établissement, JAMAIS per-seat.</span>{' '}
              Site S (&lt;150 apprenants) ~1 500 €/an · <span className="font-semibold text-[var(--text-primary)]">Site M (150-500) ~3 500 €/an = cible par défaut</span> · Site L / multi-sites 6 000-8 000 €/an · réseau national = deal-cadre.
              Formateurs et élèves illimités (l'argument tueur face au per-élève). Ne jamais citer le prix en premier : demander « quel budget accessibilité/handicap avez-vous provisionné ? ». Les 3 premières signatures = découverte de prix.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Italie — Paidea revend</span> (marge par-dessus le prix) : listino S/M/L 490 / 990 / 1 690 €/an par école, 990 = tarif recommandé, Docente 129 €. Prezzo riservato −30 %, plancher −35 % early-bird. ⚠️ Plafond TTS sur le 490.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">B2C</span> : self-serve Stripe existant, laisser-vivre, non poussé.
            </li>
            <li className="rounded-xl bg-[rgba(124,58,237,0.06)] p-3">
              <span className="font-semibold text-[var(--text-primary)]">Financements à mettre en face du prix</span> : FR = majoration OPCO
              jusqu'à ~4 000 €/an par apprenti RQTH (3-4 apprentis RQTH financent la classe entière — décideur : le référent handicap) + plan de développement des compétences.
              IT = legge 170 + fonds écoles via MEPA. ⚠️ Jamais promettre « 100 % pris en charge ».
            </li>
          </ul>
        </motion.section>

        <motion.section
          variants={staggerItem}
          className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
        >
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Les 3 arguments, dans cet ordre</h2>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
            La génération (quiz, fiches) et le reader sont gratuits ailleurs : on ne vend jamais les features, on vend le modèle et la preuve.
          </p>
          <ol className="mt-3 space-y-3">
            {ARGUMENTS_ORDRE.map((a) => (
              <li key={a.t} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
                <p className="text-[13px] font-bold text-[var(--text-primary)]">{a.t}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{a.d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Deux vocabulaires assumés : « toute la classe / accessible à tous » dans le récit de valeur ; « dys / DSA / RQTH / legge 170 »
            dans la couche financement et SEO, là où l'argent vit. Caution UDL/CAST : pour les gardiens (national, dossiers, jurys), jamais en slogan.
          </p>
        </motion.section>
      </div>

      {/* ── Roadmap ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-[var(--memovia-violet)]" aria-hidden />
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Roadmap — ce qu'on veut intégrer, et pourquoi</h2>
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Chaque ligne vient d'une demande terrain datée, jamais d'une envie de feature. Rien de daté n'est promis à un client.
        </p>
        <ul className="mt-3 space-y-2">
          {ROADMAP.map((r) => (
            <li key={r.t} className="rounded-xl bg-[var(--bg-primary)] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-[var(--text-primary)]">{r.t}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: ROAD_STATUS_STYLE[r.status].bg, color: ROAD_STATUS_STYLE[r.status].fg }}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-1 max-w-[95ch] text-[12px] leading-relaxed text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">Pourquoi : </span>{r.pourquoi}
              </p>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* ── Canal prescripteurs — appel Christelle ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-[var(--memovia-violet)]" aria-hidden />
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">
            Canal prescripteurs — l'appel Christelle (19-20/08)
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Christelle Navereau : ex-collègue 2i, ex-référente handicap (dossiers AGEFIPH/Cap Emploi montés elle-même),
          aujourd'hui FIDAL Occitanie. Personnellement engagée sur l'inclusion. Alliée active — elle a tenu chaque promesse en moins de 24 h.
        </p>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Ce qu'elle corrige ou confirme</h3>
            <ul className="space-y-2">
              {CHRISTELLE_POINTS.map((p) => (
                <li key={p.t} className="rounded-xl bg-[var(--bg-primary)] p-3">
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">{p.t}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{p.d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Qui contacter, et comment</h3>
            <ul className="space-y-2">
              {CHRISTELLE_CONTACTS.map((c) => (
                <li key={c.nom} className="rounded-xl bg-[var(--bg-primary)] p-3">
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">
                    {c.nom} <span className="font-normal text-[var(--text-secondary)]">— {c.role}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{c.action}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.section>

      {/* ── Concurrents ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Concurrents</h2>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
            {(Object.keys(VERDICT_STYLE) as Verdict[]).map((v) => (
              <span key={v} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VERDICT_STYLE[v].dot }} aria-hidden />
                {VERDICT_STYLE[v].label}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
          Panorama du 18/07/2026 (sources datées dans le vault). L'intersection accessibilité × apprentissage actif × collectif reste inoccupée : personne ne fait la boucle entière.
          Ne JAMAIS pitcher brique par brique — c'est perdre contre le spécialiste de chaque brique.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th scope="col" className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Acteur</th>
                <th scope="col" className="hidden pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)] md:table-cell">Ce qu'il fait</th>
                <th scope="col" className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-label)]">Points forts / notre réponse</th>
              </tr>
            </thead>
            <tbody>
              {CONCURRENTS.map((c) => (
                <tr key={c.nom} className="border-b border-[var(--border-subtle)] align-top last:border-0">
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: VERDICT_STYLE[c.verdict].dot }} aria-hidden />
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{c.nom}</span>
                    </span>
                    <span className="mt-0.5 block pl-4 text-[11px] text-[var(--text-muted)]">{c.segment}</span>
                  </td>
                  <td className="hidden py-2.5 pr-4 text-[12px] leading-relaxed text-[var(--text-secondary)] md:table-cell">{c.fait}</td>
                  <td className="py-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{c.fort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* ── Ce qu'on ne fait pas ── */}
      <motion.section
        variants={staggerItem}
        className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--shadow-xs)]"
      >
        <h2 className="font-display text-[17px] font-bold text-[var(--text-primary)]">Ce qu'on ne fait PAS</h2>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">Sacrifices assumés — ne pas re-litiger à chaque baisse de moral. Un positionnement qui ne renonce à rien n'est pas un positionnement.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SACRIFICES.map((s) => (
            <li key={s} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
              {s}
            </li>
          ))}
        </ul>
      </motion.section>
    </motion.div>
  )
}
