-- Migration 00001: Create dashboard_profiles table
-- Internal admin profiles for the MEMOVIA dashboard (separate from app.memovia.io users)

CREATE TABLE IF NOT EXISTS public.dashboard_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin_full', 'admin_bizdev')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboard_profiles_updated_at
  BEFORE UPDATE ON public.dashboard_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.dashboard_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can only SELECT their own profile
-- INSERTs are blocked by default (require service_role or manual SQL)
CREATE POLICY "Users can view own profile"
  ON public.dashboard_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Grant access to authenticated role
GRANT SELECT ON public.dashboard_profiles TO authenticated;
