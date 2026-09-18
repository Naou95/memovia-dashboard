/**
 * Ce qu'on ne dit jamais à un prospect. Une seule liste, lue par l'onglet Séquence des campagnes
 * et par la fiche d'appel de l'agenda : deux copies finiraient par diverger.
 */

/** Interdits vérifiés par campaignText.ts avant chaque envoi (texte de la maquette Campagnes). */
export const FORBIDDEN = [
  '« 100 % financé par l\'OPCO », « gratuit pour vous »',
  '« partenaire Agefiph »',
  '« labellisée French Tech », « soutenue par TBSeeds »',
  '« sous 48 h », « 15 minutes », « je me permets de vous relancer », « envoyez-moi un support »',
  'Un chiffre « stagiaires » de la liste OF · logo ou accord national des Compagnons',
]

/** À l'oral en plus : les règles publiques de MEMOVIA (CLAUDE.md, § 2 bis et 2 ter). */
export const FORBIDDEN_ORAL = [
  '« outil DYS », « solution de compensation », « reader »',
  'Nommer un concurrent',
  '« conforme RGAA »',
  'Citer un prix en premier · « automatique », « sans RQTH »',
]
