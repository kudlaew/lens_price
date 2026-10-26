/*
# Add numeric CYL and SPH columns to lenses

1. Modified Tables
- `lenses`
  - `sph_max` (numeric, nullable) — максимальная сфера по модулю
  - `cyl_max` (numeric, nullable) — максимальный цилиндр по модулю
  Текстовые колонки sph_range и cyl_range остаются для отображения.

2. Security
- Без изменений.

3. Data migration
- Заполняет sph_max и cyl_max из существующих текстовых значений.
*/

ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sph_max numeric;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS cyl_max numeric;

UPDATE lenses SET sph_max = sub.max_val
FROM (
  SELECT id, max(abs(m[1]::numeric)) AS max_val
  FROM lenses,
       regexp_matches(sph_range, '(\d+\.?\d*)', 'g') AS m
  WHERE sph_range IS NOT NULL AND sph_range != ''
  GROUP BY id
) sub
WHERE lenses.id = sub.id;

UPDATE lenses SET cyl_max = sub.max_val
FROM (
  SELECT id, max(abs(m[1]::numeric)) AS max_val
  FROM lenses,
       regexp_matches(cyl_range, '(\d+\.?\d*)', 'g') AS m
  WHERE cyl_range IS NOT NULL AND cyl_range != ''
  GROUP BY id
) sub
WHERE lenses.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_lenses_sph_max ON lenses (sph_max);
CREATE INDEX IF NOT EXISTS idx_lenses_cyl_max ON lenses (cyl_max);
