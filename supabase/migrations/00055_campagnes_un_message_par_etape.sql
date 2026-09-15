-- Garde contre les doublons (revue adversariale du 15/09) : deux ticks simultanés (cron et bouton
-- Actualiser) ne peuvent plus créer deux messages vivants pour la même étape d'une inscription,
-- donc plus deux brouillons envoyables du même mail.
create unique index if not exists campaign_messages_one_live_per_step
  on public.campaign_messages (enrollment_id, step_id)
  where status in ('draft', 'sent');
