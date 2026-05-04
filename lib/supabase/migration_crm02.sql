-- ─── Migración CRM-02 — ejecutar en Supabase SQL Editor ──────────────────────
-- Corre todo junto como una sola ejecución.

-- 1. Agregar columnas faltantes en contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS rubro   text,
  ADD COLUMN IF NOT EXISTS website text;

-- 2. Ampliar constraint de status en contacts (incluye CRM-01, CRM-02 y CRM-04)
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN ('cliente','oportunidad','lead','archivado','enviado','no_enviado','interesado','enviar_mail'));

-- 3. Agregar teléfono a team_members (necesario para notificación WA a vendedor)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS phone text;

-- 4. Ampliar actividades para incluir whatsapp_in si se necesita en el futuro
--    (por ahora CRM-02 usa 'email_in' — este paso es opcional)
-- ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_kind_check;
-- ALTER TABLE activities ADD CONSTRAINT activities_kind_check
--   CHECK (kind IN ('email_in','email_out','call_out','meeting','note','invoice','stage_change','whatsapp_in'));

-- ─── Verificación ────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('contacts','team_members')
  AND column_name IN ('rubro','website','phone')
ORDER BY table_name, column_name;
