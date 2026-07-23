-- Migration CRM-13: Personas secundarias por contacto
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS contact_persons (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  cargo       text,
  email       text,
  phone       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_persons_owner"
  ON contact_persons FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contact_persons_vendor"
  ON contact_persons FOR SELECT
  USING (is_workspace_member(user_id));

CREATE INDEX IF NOT EXISTS contact_persons_contact_id_idx ON contact_persons(contact_id);
