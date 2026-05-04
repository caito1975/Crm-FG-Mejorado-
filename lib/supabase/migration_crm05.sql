-- ─── Migración CRM-05 — Google Integrations ──────────────────────────────────
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla para guardar tokens OAuth por integración
CREATE TABLE IF NOT EXISTS integrations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users NOT NULL,
  provider      text NOT NULL CHECK (provider IN ('gmail','google_calendar')),
  access_token  text NOT NULL,
  refresh_token text,
  token_expiry  timestamptz,
  email         text,
  connected_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_integrations" ON integrations
  FOR ALL USING (auth.uid() = user_id);

-- 2. Columna external_id en activities para deduplicación al sincronizar Gmail
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- 3. Columna external_id en tasks para deduplicación al sincronizar Calendar
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- ─── Verificación ────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'integrations';

SELECT column_name, table_name FROM information_schema.columns
WHERE table_name IN ('activities','tasks') AND column_name = 'external_id'
ORDER BY table_name;
