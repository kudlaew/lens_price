/*
# Add multi-color links for lenses

## Overview
Adds a normalized junction table so one lens can have multiple available colors from the shared colors reference directory. Existing lens rows and the legacy single `lenses.color_id` column are preserved.

## New Tables
### lens_colors
- `lens_id` (uuid, required) — linked lens.
- `color_id` (uuid, required) — selected color from the shared `colors` directory.
- Composite primary key prevents duplicate color selections for the same lens.

## Modified Tables
- No existing columns are removed or changed.
- Existing `photochromic_colors` remains the source for multiple colors assigned to a photochromic.

## Security
- RLS is enabled on `lens_colors`.
- Anonymous and authenticated users can read color links so the public catalog can display them.
- Only authenticated administrators can insert or delete links.
- Data API grants are limited to the operations used by the application.

## Important Notes
1. Existing `lenses.color_id` values remain intact for backward compatibility.
2. New lens color selections are stored in `lens_colors`.
3. Deleting a lens removes its links; deleting a referenced color is restricted by the existing colors relationships.
*/

CREATE TABLE IF NOT EXISTS lens_colors (
  lens_id uuid NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  color_id uuid NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
  PRIMARY KEY (lens_id, color_id)
);

ALTER TABLE lens_colors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON lens_colors TO anon, authenticated;
GRANT INSERT, DELETE ON lens_colors TO authenticated;

DROP POLICY IF EXISTS "select_lens_colors" ON lens_colors;
CREATE POLICY "select_lens_colors" ON lens_colors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_lens_colors" ON lens_colors;
CREATE POLICY "admin_insert_lens_colors" ON lens_colors FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_lens_colors" ON lens_colors;
CREATE POLICY "admin_delete_lens_colors" ON lens_colors FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_lens_colors_color_id ON lens_colors(color_id);
