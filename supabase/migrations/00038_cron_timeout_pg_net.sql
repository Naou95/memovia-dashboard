-- Migration 00038 : poser un timeout pg_net explicite sur les 5 crons HTTP qui n'en avaient pas.
--
-- TROUVÉ PAR REVUE ADVERSARIALE le 14/08/2026, en vérifiant le correctif des crons morts.
--
-- 🔑 LE MÊME ANGLE MORT QUE CELUI QUI A CACHÉ 117 ÉCHECS PENDANT QUATRE MOIS, un cran plus bas.
-- `net.http_post` a `timeout_milliseconds integer DEFAULT 5000` (signature vérifiée dans pg_proc).
-- Passé ce délai, pg_net abandonne l'attente : la ligne de `net._http_response` arrive avec
-- `status_code` à NULL et `error_msg = 'Timeout of 5000 ms reached'`. Or `cron.job_run_details`
-- ne voit QUE la commande SQL, qui a parfaitement réussi — elle enregistre « succeeded ».
-- Résultat : un cron peut ne jamais rien accomplir pendant des mois en étant compté vert.
--
-- Mesuré le 14/08 sur la fenêtre de rétention de `net._http_response` (~6 h seulement, 05h30
-- → 11h00 UTC) : 26 réponses, dont **3 avec status_code NULL** par timeout à 5 s. Pendant ce
-- temps `cron.job_run_details` affichait 0 échec pour les jobs concernés.
--
-- Une edge function Supabase démarre à froid : le cold start seul mange souvent plus de 5 s.
-- 30 s laisse la marge sans immobiliser un worker pg_net (ces crons tournent au mieux à l'heure).
-- Ce n'est PAS un correctif de performance : la fonction s'exécutait déjà jusqu'au bout côté
-- serveur. C'est un correctif d'OBSERVABILITÉ — on récupère le code HTTP, donc la preuve.
--
-- ⚠️ POURQUOI CETTE MIGRATION EST DANS LE DÉPÔT `dashboard` alors que 4 des 5 crons servent
-- des fonctions de l'app : les deux dépôts partagent le projet Supabase `mzjzwffpqubpruyaaxew`,
-- donc un seul `cron.job`. La plomberie cron (secret dédié, verify_cron_secret, replanification)
-- a été posée ici en 00034-00037 ; la garder à un seul endroit vaut mieux que la couper en deux.
-- Origine réelle de chaque cron, pour qui la cherchera :
--   jobs 1/2/3/4 → app/supabase/migrations/20251023141236_*.sql et 20260212145931_*.sql
--   job 8        → dashboard/supabase/migrations/00020_email_notifications_sent.sql
--
-- Le job `cleanup-telegram-security` est volontairement EXCLU : c'est du SQL pur (deux DELETE),
-- il ne fait aucun appel HTTP, un timeout pg_net n'aurait aucun sens dessus.
--
-- Réécriture par regexp plutôt qu'en réécrivant les commandes à la main : les commandes des jobs
-- 1, 3 et 4 contiennent une clé en clair, et la recopier ici la ferait entrer dans le dépôt git.
-- Le motif `::jsonb` suivi d'espaces puis `)` ne matche que le DERNIER argument de l'appel (les
-- précédents sont suivis d'une virgule) — vérifié à blanc sur les 5 commandes avant application.
-- Idempotent : le garde `not like '%timeout_milliseconds%'` saute les jobs déjà traités, et après
-- réécriture le motif ne matche plus.

do $$
declare
  j record;
  commande_neuve text;
  traites int := 0;
begin
  for j in
    select jobid, jobname, command
    from cron.job
    where jobname in (
            'monthly-bonus-reset',
            'check-trial-expiry-daily',
            'cleanup-stale-live-sessions',
            'cleanup-expired-notes-daily',
            'notify-new-email'
          )
      and command like '%net.http_post%'
      and command not like '%timeout_milliseconds%'
    order by jobid
  loop
    commande_neuve := regexp_replace(
      j.command,
      '::jsonb(\s*)\)',
      '::jsonb,\1    timeout_milliseconds := 30000\1)'
    );

    -- Si le motif n'a pas mordu, on ne replanifie SURTOUT pas une commande inchangée en croyant
    -- avoir corrigé quelque chose : on casse la migration pour que ça se voie.
    if commande_neuve = j.command then
      raise exception 'Cron % (jobid %) : motif de reecriture introuvable, rien n''a ete change',
        j.jobname, j.jobid;
    end if;

    perform cron.alter_job(job_id := j.jobid, command := commande_neuve);
    traites := traites + 1;
    raise notice 'Cron % (jobid %) : timeout pg_net pose a 30000 ms', j.jobname, j.jobid;
  end loop;

  raise notice '00038 : % cron(s) traite(s)', traites;
end $$;
