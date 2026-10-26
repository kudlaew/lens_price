/*
# Create per-lens SPH/CYL power ranges

## Overview
Adds a child table for the exact optical power limitations of each lens. A lens may have any number of rows, allowing different cylinder limits for different sphere intervals.

## New Table
### lens_power_ranges
- `id` (uuid, primary key) — range row identifier.
- `lens_id` (uuid, required) — parent lens.
- `sph_min`, `sph_max` (numeric, required) — sphere boundaries.
- `sph_step` (numeric, required) — sphere increment.
- `cyl_min`, `cyl_max` (numeric, required) — cylinder boundaries valid for the sphere range.
- `cyl_step` (numeric, required) — cylinder increment.
- `allowed_combinations` (jsonb) — optional exact `{sph, cyl}` pairs for irregular manufacturer tables.
- `created_at` (timestamptz) — creation time.

## Modified Tables
- No existing lens columns are removed or changed.
- Existing `sph_range`, `cyl_range`, `sph_max`, and `cyl_max` remain the fallback for lenses without child rows.

## Security
- RLS is enabled on the new table.
- All catalog users may read rows.
- Only authenticated administrators may insert, update, or delete rows.
- Grants are limited to the operations used by the catalog.

## Important Notes
1. Multiple rows may be stored for one lens.
2. A non-empty exact-pair list is authoritative for that row; otherwise the stepped rectangular ranges are used.
3. Foreign-key cascade removes range rows only when the parent lens itself is removed.
4. Existing lens data is preserved and remains compatible.
*/

CREATE TABLE IF NOT EXISTS lens_power_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_id uuid NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  sph_min numeric NOT NULL,
  sph_max numeric NOT NULL,
  sph_step numeric NOT NULL DEFAULT 0.25,
  cyl_min numeric NOT NULL,
  cyl_max numeric NOT NULL,
  cyl_step numeric NOT NULL DEFAULT 0.25,
  allowed_combinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lens_power_ranges_sph_order CHECK (sph_min <= sph_max),
  CONSTRAINT lens_power_ranges_cyl_order CHECK (cyl_min <= cyl_max),
  CONSTRAINT lens_power_ranges_sph_step_positive CHECK (sph_step > 0),
  CONSTRAINT lens_power_ranges_cyl_step_positive CHECK (cyl_step > 0),
  CONSTRAINT lens_power_ranges_pairs_array CHECK (jsonb_typeof(allowed_combinations) = 'array')
);

ALTER TABLE lens_power_ranges ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON lens_power_ranges TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON lens_power_ranges TO authenticated;

DROP POLICY IF EXISTS "select_lens_power_ranges" ON lens_power_ranges;
CREATE POLICY "select_lens_power_ranges" ON lens_power_ranges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_lens_power_ranges" ON lens_power_ranges;
CREATE POLICY "admin_insert_lens_power_ranges" ON lens_power_ranges FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_lens_power_ranges" ON lens_power_ranges;
CREATE POLICY "admin_update_lens_power_ranges" ON lens_power_ranges FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_lens_power_ranges" ON lens_power_ranges;
CREATE POLICY "admin_delete_lens_power_ranges" ON lens_power_ranges FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_lens_power_ranges_lens_id ON lens_power_ranges(lens_id);
