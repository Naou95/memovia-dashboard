import { motion } from 'framer-motion'
import { Mic, Wand2, Radio, Repeat2, BadgeCheck, ShieldAlert, Hammer } from 'lucide-react'
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
              Pilote (1 site, 1 an, non renouvelable) 3 000 € · Site S (&lt;150 apprenants) 6 000 €/an · <span className="font-semibold text-[var(--text-primary)]">Site M (150-500) 12 000 €/an = cible par défaut</span> · Site L (&gt;500) 20 000 €/an · réseau 12 000 € + 6 000 €/site, plafond 36 000 €.
              Formateurs et élèves illimités (l'argument tueur face au per-élève). Ne jamais citer le prix en premier. Toute remise est nommée, datée et à bascule écrite au contrat ; les 3 premières signatures = découverte de prix.
              🔴 Ne pas publier cette grille tant qu'il n'y a qu'un client : devis uniquement.
            </li>
            <li className="rounded-xl bg-[rgba(124,58,237,0.06)] p-3">
              <span className="font-semibold text-[var(--text-primary)]">La règle qui fixe le prix</span> (conseil du 22/08, unanimité) : la majoration RQTH finance TOUTE l'adaptation d'un apprenti, pas seulement un logiciel. Une ligne SaaS en capte 20 à 35 %, soit <span className="font-semibold text-[var(--text-primary)]">~1 200 € par apprenti RQTH</span> — il en faut donc une dizaine pour porter un Site M.
              Première question de qualification : « combien d'apprentis RQTH avez-vous déclarés cette année ? ». ⚠️ Plafond réseau à 36 000 € délibéré : au-delà de 40 000 € HT, un CFA porté par une CCI ou une CMA sort de la dispense de procédure et déclenche une mise en concurrence.
            </li>
            <li className="rounded-xl bg-[var(--bg-primary)] p-3">
              <span className="font-semibold text-[var(--text-primary)]">Le taux RQTH n'est pas une inconnue, il est sourcé</span> : DARES (publié 27/02/2026) — 18 800 contrats d'apprentissage signés par des travailleurs handicapés en 2025, <span className="font-semibold text-[var(--text-primary)]">soit 2 % des nouveaux contrats</span>.
              À 2 %, un site de 500 apprenants porte ~10 dossiers, ce qui valide le Site M à 12 000 €. Un site de 150, borne basse de la même tranche, n'en porte que 3, soit ~3 600 € défendables.
              🔑 <span className="font-semibold text-[var(--text-primary)]">La grille tient par le HAUT de chaque tranche</span> : un CFA de 200 apprenants avec 4 RQTH n'est pas un deal à 12 000 €, c'est un pilote. C'est la question de qualification qui tranche, pas la tranche d'effectif.
              ⚠️ Deux réserves : 2 % est un flux d'entrées 2025, pas un stock, et c'est une moyenne nationale — les CFA dont le référent handicap est assez engagé pour acheter sont mécaniquement au-dessus.
            </li>
            <li className="rounded-xl bg-[rgba(124,58,237,0.06)] p-3">
              <span className="font-semibold text-[var(--text-primary)]">Compagnons, renégociation de la rentrée</span> : 🔴 ne PAS renégocier en licences — ça ratifierait le per-seat comme terme de référence de notre unique contrat signé, et chaque CFA suivant l'exigerait.
              On vend le site de Toulouse (~600 apprentis = palier L, 20 000 €) avec une remise nommée « programme de référence » qui atterrit à 12 000 €. Ce nombre ne se négocie pas : 200 licences × 60 € = 12 000 €, exactement ce qu'ils avaient déjà budgété.
              🔑 Le vrai blocage n'est pas le prix : le référent handicap ne fait pas de ROI, il lui faut la pièce à classer (apprenti nommé, période, séances). L'export d'attestation d'usage débloque chaque euro au-dessus de 12 000 €.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Italie — Paidea revend</span> (marge par-dessus le prix) : listino S/M/L 490 / 990 / 1 690 €/an par école, 990 = tarif recommandé, Docente 129 €. Prezzo riservato −30 %, plancher −35 % early-bird. ⚠️ Plafond TTS sur le 490.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">B2C</span> : self-serve Stripe existant, laisser-vivre, non poussé.
            </li>
            <li className="rounded-xl bg-[rgba(124,58,237,0.06)] p-3">
              <span className="font-semibold text-[var(--text-primary)]">Financements à mettre en face du prix</span> : FR = majoration OPCO
              jusqu'à ~4 000 €/an par apprenti RQTH versés au CFA, dont le logiciel ne capte que 20-35 % (décideur : le référent handicap) + plan de développement des compétences.
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
