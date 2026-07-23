-- Migration CRM-15: Allow vendors to INSERT and DELETE contact_persons
-- The existing "contact_persons_vendor" policy only covers SELECT.
-- Vendors need INSERT to add secondary persons, and DELETE to remove their own entries.
-- Run in Supabase SQL Editor

CREATE POLICY "contact_persons_vendor_insert"
  ON contact_persons FOR INSERT
  WITH CHECK (is_workspace_member(user_id));

CREATE POLICY "contact_persons_vendor_delete"
  ON contact_persons FOR DELETE
  USING (is_workspace_member(user_id));
