-- ─── Migración CRM-06 — Workspace compartido + Invitación de vendedores ──────
-- Ejecutar en Supabase SQL Editor (o vía Management API)

-- 1. Agregar member_user_id a team_members
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users;

CREATE INDEX IF NOT EXISTS idx_team_members_member_user_id
  ON team_members(member_user_id);

-- 2. Trigger: auto-link cuando un vendedor invitado acepta y se registra
CREATE OR REPLACE FUNCTION link_team_member_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_members
    SET member_user_id = NEW.id,
        status = 'activo'
  WHERE email = NEW.email
    AND member_user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_team_member_on_signup();

-- 3. Eliminar RLS existentes y recrear con soporte de workspace
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contacts','deals','tasks','activities','pipeline_stages','inbox_messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Helper: check if auth.uid() is a member of the given owner's workspace
CREATE OR REPLACE FUNCTION is_workspace_member(owner_uid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE owner_id = owner_uid
      AND member_user_id = auth.uid()
      AND status = 'activo'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- contacts
CREATE POLICY "workspace_contacts" ON contacts FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- deals
CREATE POLICY "workspace_deals" ON deals FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- tasks
CREATE POLICY "workspace_tasks" ON tasks FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- activities
CREATE POLICY "workspace_activities" ON activities FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- pipeline_stages
CREATE POLICY "workspace_stages" ON pipeline_stages FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- inbox_messages
CREATE POLICY "workspace_inbox" ON inbox_messages FOR ALL USING (
  auth.uid() = user_id OR is_workspace_member(user_id)
);

-- ─── Verificación ────────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'team_members' AND column_name = 'member_user_id';

SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('contacts','deals','tasks','activities','pipeline_stages','inbox_messages')
ORDER BY tablename;
