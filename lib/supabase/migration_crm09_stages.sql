-- Migration CRM09: Replace enviar_mail with contactar + contactado
-- Run this in Supabase SQL Editor

-- 1. Remove enviar_mail stage
DELETE FROM pipeline_stages WHERE id = 'enviar_mail';

-- 2. Insert contactar and contactado for every workspace that has the enviado stage
INSERT INTO pipeline_stages (id, label, color, position, user_id)
SELECT
  'contactar',
  'Contactar',
  'oklch(70% 0.10 200)',
  1,
  user_id
FROM pipeline_stages
WHERE id = 'enviado'
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (id, label, color, position, user_id)
SELECT
  'contactado',
  'Contactado',
  'oklch(68% 0.12 195)',
  2,
  user_id
FROM pipeline_stages
WHERE id = 'enviado'
ON CONFLICT DO NOTHING;

-- 3. Update positions of existing stages (shift +2)
UPDATE pipeline_stages SET position = 3  WHERE id = 'interesado';
UPDATE pipeline_stages SET position = 4  WHERE id = 'reu_inicial';
UPDATE pipeline_stages SET position = 5  WHERE id = 'seg_reu';
UPDATE pipeline_stages SET position = 6  WHERE id = 'prop_enviada';
UPDATE pipeline_stages SET position = 7  WHERE id = 'doc_enviada';
UPDATE pipeline_stages SET position = 8  WHERE id = 'doc_firmada';
UPDATE pipeline_stages SET position = 9  WHERE id = 'ped_fc';
UPDATE pipeline_stages SET position = 10 WHERE id = 'ganado';
UPDATE pipeline_stages SET position = 11 WHERE id = 'perdido';

-- 4. Move deals that were in enviar_mail to contactar
UPDATE deals SET stage_id = 'contactar' WHERE stage_id = 'enviar_mail';
