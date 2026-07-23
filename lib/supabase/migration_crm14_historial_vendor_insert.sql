-- Migration CRM-14: Allow vendors to INSERT into historial_leads
-- The existing "Workspace historial" policy only covers SELECT.
-- Vendors need INSERT permission to register their own actions
-- (calls, notes, emails, WhatsApp) from ContactDetail and Inbox.
-- Run in Supabase SQL Editor

CREATE POLICY "historial_vendor_insert"
  ON historial_leads FOR INSERT
  WITH CHECK (is_workspace_member(user_id));
