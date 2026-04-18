-- ============================================================
-- Migration 00005 — contract_documents + Storage bucket
-- ============================================================

-- Table
CREATE TABLE IF NOT EXISTS contract_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_path    text        NOT NULL,
  file_size    bigint      NOT NULL DEFAULT 0,
  uploaded_by  uuid        REFERENCES dashboard_profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_documents_contract_id_idx
  ON contract_documents(contract_id);

-- RLS — table
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_documents_select"
  ON contract_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "contract_documents_insert"
  ON contract_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "contract_documents_delete"
  ON contract_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

-- ============================================================
-- Supabase Storage bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  20971520,  -- 20 MB max par fichier
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS — storage.objects
-- SELECT : tout utilisateur authentifié peut lire/télécharger
CREATE POLICY "contract_documents_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contract-documents'
    AND auth.uid() IS NOT NULL
  );

-- INSERT : tout utilisateur authentifié peut uploader
CREATE POLICY "contract_documents_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-documents'
    AND auth.uid() IS NOT NULL
  );

-- DELETE : admin_full uniquement
CREATE POLICY "contract_documents_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contract-documents'
    AND EXISTS (
      SELECT 1 FROM dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );
