-- ─── Migración CRM-10 — Fix RLS para vendedores ───────────────────────────────
-- Problema raíz: team_members solo tenía política "auth.uid() = owner_id"
-- Un vendedor no puede leer su propio registro → getWorkspaceOwnerId devuelve
-- el ID del vendedor como workspaceId → todas las queries retornan vacías.
--
-- EJECUTAR EN SUPABASE SQL EDITOR

-- ─── 1. Permitir que los miembros lean su propio registro ─────────────────────
-- (Necesario para que getWorkspaceOwnerId funcione correctamente)
DROP POLICY IF EXISTS "member_can_read_own" ON team_members;
CREATE POLICY "member_can_read_own" ON team_members
  FOR SELECT
  USING (member_user_id = auth.uid());

-- ─── 2. Asegurarse de que existan las políticas de deals para vendedores ───────
-- (Si migration_crm08 ya fue ejecutada, los DROP no harán nada malo)
DROP POLICY IF EXISTS "workspace_deals" ON deals;
DROP POLICY IF EXISTS "Own deals"       ON deals;
DROP POLICY IF EXISTS "deals_owner"     ON deals;
DROP POLICY IF EXISTS "deals_vendor"    ON deals;

CREATE POLICY "deals_owner" ON deals
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_vendor" ON deals
  FOR ALL
  USING  (is_workspace_member(user_id) AND assigned_to = auth.uid())
  WITH CHECK (is_workspace_member(user_id) AND assigned_to = auth.uid());

-- ─── 3. Asegurarse de que existan las políticas de contacts para vendedores ────
DROP POLICY IF EXISTS "workspace_contacts" ON contacts;
DROP POLICY IF EXISTS "Own contacts"       ON contacts;
DROP POLICY IF EXISTS "contacts_owner"     ON contacts;
DROP POLICY IF EXISTS "contacts_vendor"    ON contacts;

CREATE POLICY "contacts_owner" ON contacts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_vendor" ON contacts
  FOR ALL
  USING  (is_workspace_member(user_id) AND assigned_to = auth.uid())
  WITH CHECK (is_workspace_member(user_id) AND assigned_to = auth.uid());

-- ─── 4. Verificación ──────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('team_members','deals','contacts')
ORDER BY tablename, policyname;
