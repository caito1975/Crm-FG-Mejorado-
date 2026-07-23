-- Migration CRM-11: Metas mensuales por vendedor
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sales_targets (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        uuid NOT NULL,
  vendor_name     text NOT NULL,
  month           date NOT NULL,       -- always first day of month: YYYY-MM-01
  target_acciones integer NOT NULL DEFAULT 0,
  target_ganados  integer NOT NULL DEFAULT 0,
  target_monto    numeric  NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (owner_id, vendor_name, month)
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets_owner_all" ON sales_targets
  FOR ALL
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
