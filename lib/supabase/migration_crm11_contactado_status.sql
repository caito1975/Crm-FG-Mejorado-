-- ─── Migración CRM-11 — Agregar 'contactado' y 'contactar' al constraint de contacts.status ───
-- Ejecutar en Supabase SQL Editor

-- El constraint original solo incluía enviar_mail pero no contactar ni contactado
-- que son las etapas del pipeline. Esto causaba error silencioso al sincronizar estado.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN (
    'cliente',
    'oportunidad',
    'lead',
    'archivado',
    'enviado',
    'no_enviado',
    'interesado',
    'contactar',
    'contactado'
  ));

-- Verificación
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'contacts'::regclass AND contype = 'c' AND conname = 'contacts_status_check';
