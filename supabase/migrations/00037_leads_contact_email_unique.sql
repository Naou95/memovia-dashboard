-- Migration 00037 : empêcher les doublons de leads, que la 00036 a rendus plus probables.
--
-- TROUVÉ PAR REVUE ADVERSARIALE le 14/08/2026, sur le correctif de la veille au soir.
--
-- `upsertLead` (email-lead-detector/index.ts) fait un **select-puis-insert** sur `contact_email` :
--   select id from leads where contact_email = ?   →   si absent, insert
-- Entre le select et l'insert, rien ne protège. Or aucun index unique ne couvre `contact_email` :
-- le seul index unique de la table est `leads_email_message_id_unique`, posé sur une colonne que
-- `email-lead-detector` **ne renseigne jamais** (0 occurrence de `email_message_id` dans le
-- fichier). Ce garde-fou ne s'est donc jamais déclenché une seule fois.
--
-- 🔑 Pourquoi c'est urgent maintenant : la 00036 a porté le budget de la fonction de 45 s à 110 s,
-- ce qui **triple la fenêtre de collision**. Et le `Promise.race` du handler n'annule PAS
-- `runDetector` quand le timeout gagne : le scan continue en arrière-plan, appelle Claude (facturé)
-- et écrit en base après que la réponse 504 soit partie. Le 14/08 en fin de matinée, trois appels
-- se sont chevauchés (504 à 09:37:50, 504 à 09:40:29, 200 à 09:42:44) : les deux zombies pouvaient
-- encore écrire pendant que le troisième insérait.
--
-- Scénario concret, pas théorique : le cron tourne à 23:00, Naoufel clique « détecter » dans
-- EmailPage à 23:01, les deux analysent la même conversation, les deux `select` ne trouvent rien,
-- les deux insèrent. Deux lignes pour le même prospect, et un CRM qui ment.
--
-- Deux verrous complémentaires :
--   1. l'index unique ci-dessous = garantie dure, au niveau base, quel que soit l'appelant ;
--   2. un verrou consultatif dans la fonction = évite le travail en double (et les appels Claude
--      facturés en double) plutôt que de le rattraper après coup.
--
-- Vérifié avant création : `select contact_email, count(*) ... having count(*) > 1` rend 0 ligne,
-- l'index peut être posé sans nettoyage préalable.

create unique index if not exists leads_contact_email_unique
  on public.leads (contact_email)
  where contact_email is not null;

comment on index public.leads_contact_email_unique is
  'Empeche deux leads pour le meme email. upsertLead fait un select-puis-insert non atomique, et le cron peut se chevaucher avec un declenchement manuel depuis le dashboard. Pose le 14/08/2026.';
