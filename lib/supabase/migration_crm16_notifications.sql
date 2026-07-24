-- Migration CRM-16: Notifications table for vendor lead assignments
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,          -- workspace owner id (for RLS)
  for_user_id uuid NOT NULL,          -- vendor auth.uid() who receives it
  tipo        text NOT NULL DEFAULT 'asignacion',
  titulo      text NOT NULL,
  mensaje     text,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE,
  leida       boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owner: full access to workspace notifications
CREATE POLICY "notif_owner"
  ON notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Any workspace member can insert notifications (to notify other vendors)
CREATE POLICY "notif_member_insert"
  ON notifications FOR INSERT
  WITH CHECK (is_workspace_member(user_id));

-- Vendors can read their own notifications
CREATE POLICY "notif_vendor_read"
  ON notifications FOR SELECT
  USING (auth.uid() = for_user_id);

-- Vendors can mark their own notifications as read
CREATE POLICY "notif_vendor_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = for_user_id)
  WITH CHECK (auth.uid() = for_user_id);

CREATE INDEX IF NOT EXISTS notifications_for_user_id_idx ON notifications(for_user_id);
CREATE INDEX IF NOT EXISTS notifications_leida_idx ON notifications(for_user_id, leida);
