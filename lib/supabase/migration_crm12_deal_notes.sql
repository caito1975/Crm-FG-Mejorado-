-- CRM-12: Add notes column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS notes text;
