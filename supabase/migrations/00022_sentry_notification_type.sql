-- supabase/migrations/00022_sentry_notification_type.sql
-- Étend le check constraint dashboard_notifications.type pour inclure sentry_critical

alter table public.dashboard_notifications
  drop constraint if exists dashboard_notifications_type_check;

alter table public.dashboard_notifications
  add constraint dashboard_notifications_type_check
  check (type in ('lead_stale', 'email_critical', 'new_lead', 'stripe_cancel', 'sentry_critical'));
