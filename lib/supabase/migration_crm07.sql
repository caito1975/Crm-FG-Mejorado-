-- ─── Migración CRM-07 — Historial de Leads ───────────────────
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS historial_leads (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz DEFAULT now(),
  user_id        uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha          timestamptz NOT NULL DEFAULT now(),
  nombre         text        NOT NULL,
  numero         text,
  tipo           text        NOT NULL
                             CHECK (tipo IN ('ASIGNACION','CAMBIO_ESTADO','NOTA','LLAMADA','EMAIL')),
  mensaje        text,
  etapa_anterior text,
  etapa_nueva    text,
  vendedor       text,
  notas          text,
  contact_id     uuid        REFERENCES contacts(id) ON DELETE SET NULL
);

ALTER TABLE historial_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own historial" ON historial_leads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para miembros del workspace (requiere migration_crm06)
CREATE POLICY "Workspace historial" ON historial_leads
  FOR SELECT USING (is_workspace_member(user_id));

CREATE INDEX IF NOT EXISTS historial_leads_user_fecha
  ON historial_leads(user_id, fecha DESC);

CREATE INDEX IF NOT EXISTS historial_leads_contact
  ON historial_leads(contact_id, fecha DESC);

-- Agregar a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE historial_leads;
