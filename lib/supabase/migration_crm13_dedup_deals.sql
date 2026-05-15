-- CRM-13: Eliminar deals duplicados por contacto (conserva el más reciente activo)
-- Ejecutar una vez en Supabase SQL Editor para limpiar duplicados existentes

DELETE FROM deals
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY contact_id
        ORDER BY created_at DESC
      ) AS rn
    FROM deals
    WHERE contact_id IS NOT NULL
      AND stage_id NOT IN ('ganado', 'perdido')
  ) ranked
  WHERE rn > 1
);
