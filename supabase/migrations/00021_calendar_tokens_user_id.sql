-- Migration 21 : Lier calendar_tokens et calendar_oauth_states au user_id Supabase Auth
-- Chaque utilisateur du dashboard peut désormais connecter son propre Google Calendar.
-- Avant : owner TEXT hardcodé à 'naoufel'|'emir'
-- Après : user_id UUID référencé sur auth.users(id)

-- ── calendar_tokens ────────────────────────────────────────────────────────────

-- 1. Supprimer la contrainte CHECK sur owner (CHECK (owner IN ('naoufel', 'emir')))
ALTER TABLE calendar_tokens
  DROP CONSTRAINT IF EXISTS calendar_tokens_owner_check;

-- 2. Supprimer l'ancienne contrainte UNIQUE (owner, provider)
ALTER TABLE calendar_tokens
  DROP CONSTRAINT IF EXISTS calendar_tokens_owner_provider_key;

-- 3. Ajouter la colonne user_id (nullable pour ne pas bloquer les lignes existantes)
ALTER TABLE calendar_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Contrainte UNIQUE sur (user_id, provider) — NULL != NULL en PG, pas de conflit
ALTER TABLE calendar_tokens
  ADD CONSTRAINT calendar_tokens_user_id_provider_key UNIQUE (user_id, provider);

-- ── calendar_oauth_states ──────────────────────────────────────────────────────

-- 5. Supprimer la contrainte CHECK sur owner de calendar_oauth_states
ALTER TABLE calendar_oauth_states
  DROP CONSTRAINT IF EXISTS calendar_oauth_states_owner_check;

-- 6. Ajouter user_id (pas de FK ici : le callback OAuth n'a pas de JWT Supabase)
ALTER TABLE calendar_oauth_states
  ADD COLUMN IF NOT EXISTS user_id uuid;
