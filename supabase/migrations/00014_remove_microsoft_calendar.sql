-- Migration 00014 : Suppression de Microsoft Calendar
-- Retire Microsoft de calendar_tokens et calendar_oauth_states.
-- Seul Google Calendar (Naoufel) est conservé.

-- Nettoyer les tokens Microsoft existants
DELETE FROM calendar_tokens WHERE provider = 'microsoft';
DELETE FROM calendar_oauth_states WHERE provider = 'microsoft';

-- Mettre à jour la contrainte provider sur calendar_tokens
ALTER TABLE calendar_tokens DROP CONSTRAINT IF EXISTS calendar_tokens_provider_check;
ALTER TABLE calendar_tokens ADD CONSTRAINT calendar_tokens_provider_check CHECK (provider IN ('google'));

-- Mettre à jour la contrainte provider sur calendar_oauth_states
ALTER TABLE calendar_oauth_states DROP CONSTRAINT IF EXISTS calendar_oauth_states_provider_check;
ALTER TABLE calendar_oauth_states ADD CONSTRAINT calendar_oauth_states_provider_check CHECK (provider IN ('google'));

COMMENT ON TABLE calendar_tokens IS 'Token OAuth Google Calendar pour le module Calendrier (compte Naoufel uniquement). Auto-refreshé par les Edge Functions.';
