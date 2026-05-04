-- ─── Migración CRM-08 — Multi-tenant: assigned_to en contacts/deals ───────────
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar assigned_to a contacts (UUID del vendedor asignado)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users;

-- 2. Agregar assigned_to a deals
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to    ON deals(assigned_to);

-- 4. Reemplazar la política workspace_contacts por dos políticas separadas:
--    - owner: ve y modifica todos los contactos del workspace
--    - vendor: ve y modifica solo los contactos que le fueron asignados

DROP POLICY IF EXISTS "workspace_contacts" ON contacts;

CREATE POLICY "contacts_owner" ON contacts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_vendor" ON contacts
  FOR ALL
  USING  (is_workspace_member(user_id) AND assigned_to = auth.uid())
  WITH CHECK (is_workspace_member(user_id) AND assigned_to = auth.uid());

-- 5. Reemplazar la política workspace_deals
DROP POLICY IF EXISTS "workspace_deals" ON deals;

CREATE POLICY "deals_owner" ON deals
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_vendor" ON deals
  FOR ALL
  USING  (is_workspace_member(user_id) AND assigned_to = auth.uid())
  WITH CHECK (is_workspace_member(user_id) AND assigned_to = auth.uid());

-- 6. Helper: devuelve el member_user_id del vendor con menos contactos asignados
--    Usado por el webhook de n8n para round-robin equitativo
CREATE OR REPLACE FUNCTION next_round_robin_vendor(owner_uid uuid)
RETURNS uuid AS $$
  SELECT tm.member_user_id
  FROM   team_members tm
  LEFT JOIN contacts c
    ON c.assigned_to = tm.member_user_id
    AND c.user_id = owner_uid
  WHERE  tm.owner_id = owner_uid
    AND  tm.member_user_id IS NOT NULL
    AND  tm.status = 'activo'
  GROUP BY tm.member_user_id, tm.created_at
  ORDER BY COUNT(c.id) ASC, tm.created_at ASC
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Verificación ─────────────────────────────────────────────────────────────
SELECT column_name, table_name
FROM   information_schema.columns
WHERE  table_name IN ('contacts', 'deals')
  AND  column_name = 'assigned_to'
ORDER BY table_name;

SELECT policyname, tablename, cmd
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  IN ('contacts', 'deals')
ORDER BY tablename, policyname;
