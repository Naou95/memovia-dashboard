# Campagnes de prospection (séquences mail + appels), spec du 15/09/2026

Maquette validée par Naoufel le 15/09 : `Naoufel-Vault/03-memovia/prospection/maquette-prospection-campagne-2026-09-15.html`
(grammaire Lemlist : Séquence › Contacts › Revue › Rapports).

## Ce que ça fait

Une campagne = une séquence d'étapes (mail, appel, arrêt) appliquée à des contacts. Les contacts
sont les `leads` existants : aucune seconde liste. Pour chaque contact et chaque étape mail, l'IA
rédige un brouillon à partir du modèle de l'étape (zones `{{IA: consigne}}`) et de la fiche du
lead. Rien ne part sans qu'un humain clique « Valider et envoyer » dans la Revue (décision :
tout est validé, relances comprises). L'envoi passe par le SMTP Hostinger déjà branché, en
réponse dans le même fil pour les relances. La séquence s'arrête seule dès qu'une réponse du
contact arrive dans la boîte, qu'un refus est logué à l'appel, ou que le lead passe « perdu ».

## Données (migration 00054)

- `campaigns` : name, emoji, status (draft | live | paused | archived), sender_email, owner.
- `campaign_steps` : campaign_id, position, kind (email | call | stop), wait_days, name,
  subject_template, body_template, ai_brief.
- `campaign_enrollments` : campaign_id + lead_id (unique), status (active | stopped | done),
  current_position, next_due_at, stop_reason, thread_message_id, thread_subject.
- `campaign_messages` : enrollment_id, step_id, kind, status (draft | sent | done | skipped),
  subject, body (les passages IA entre `[[ ]]`, retirés à l'envoi), checks, context, due_at,
  sent_at, message_id, outcome (appels), note.
- RLS : une seule policy admin (`is_dashboard_admin`), anon révoqué, comme `lead_calls`.
- Seed : campagne « CFA · référent handicap » en brouillon, 5 étapes (mail J0, appel J+4,
  mail J+10, appel J+18, mail J+30) avec les textes validés v9 / v3.
- Cron `campaign-tick-daily` à 05:00 UTC (07:00 Paris), même mécanisme que 00041.

## Edge functions

- `campaign-tick` (cron ou bouton) : pour chaque inscription active, détecte une réponse (IMAP :
  mail du contact reçu depuis le début de l'inscription), arrête si réponse / perdu, crée le
  brouillon de l'étape due (mail : génération Gemini 2.5 Flash ; appel : tâche).
- `campaign-send` : reçoit le message validé (objet, corps édités), revérifie les interdits,
  envoie par SMTP (`emir@memovia.io` par défaut), enregistre le Message-ID, avance
  l'inscription, met à jour le lead (statut, dernier contact, timeline).
- La logique pure (assemblage du modèle, contrôles, interdits) vit dans
  `_shared/campaignText.ts`, testée par vitest.

## Front (`src/modules/campagnes`, route `/campagnes`, entrée de nav « Campagnes »)

- Liste des campagnes ; page campagne à 4 onglets.
- Séquence : flux vertical des étapes, panneau d'édition du modèle (objet, corps, consigne,
  attente).
- Contacts : inscriptions + ajout depuis les leads existants + import CSV (format de la liste
  du 13/09 : Établissement, Email du catalogue, Ville, Région, Métiers dominants…).
- Revue : file des brouillons (mails et appels), éditeur du mail tel qu'il sera reçu, passages
  IA surlignés, mail précédent replié, contrôles, « Valider et envoyer ». Mobile : plein écran.
- Rapports : entonnoir (contactés, joints, réponses, intéressés, RDV, refus) et table par étape.

## Hors périmètre

Resend, tracking d'ouverture, conditions multiples, LinkedIn, envoi automatique sans validation.
