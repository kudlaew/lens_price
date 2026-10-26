/*
# Add ekka, myopia_control columns to lenses; create colors reference table

## Overview
Adds two new lens columns (ekka string, myopia_control boolean), a new
`colors` reference table, and a `photochromic_colors` junction table.
Colors can be linked to lenses (single color_id) and to photochromics
(many colors via junction). The existing `available_colors` text[] on
photochromics is preserved.

## New Columns on `lenses`
1. `ekka` (text, nullable) — ЭККА (Единый каталогный код). Free-text trade
   identifier. Nullable so existing rows are unaffected.
2. `myopia_control` (boolean, not null, default false) — whether the lens
   is a myopia-control lens. Defaults to false for safety: unknown/old
   lenses are NOT assumed to have myopia control.
3. `color_id` (uuid, nullable, FK → colors(id) ON DELETE SET NULL) —
   optional lens base color.

## New Tables
1. `colors`
   - id (uuid, PK)
   - name (text, not null) — case-insensitive + whitespace-trimmed unique
   - hex (text, nullable) — optional hex swatch code
   - created_at (timestamptz)
2. `photochromic_colors` (junction)
   - photochromic_id (uuid, FK → photochromics.id ON DELETE CASCADE)
   - color_id (uuid, FK → colors.id ON DELETE RESTRICT)
   - PRIMARY KEY (photochromic_id, color_id)

## Security
- `colors` + `photochromic_colors`: SELECT public (anon + authenticated),
  writes admin-only via public.is_admin().
- RLS enabled on both; grants added.
- Existing lenses RLS unchanged; new columns inherit existing policies.

## Important Notes
- All new lens columns nullable/defaulted so old rows are safe.
- myopia_control defaults false — never asserts control for legacy data.
- Colors cannot be hard-deleted while referenced by a photochromic (RESTRICT);
  the UI warns admins. Lens references use SET NULL.
*/

-- === colors table (created FIRST so lenses FK can resolve) ===
CREATE TABLE IF NOT EXISTS colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hex text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_colors_name_ci_trim
  ON colors (lower(btrim(name)));

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON colors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON colors TO authenticated;

DROP POLICY IF EXISTS "select_colors" ON colors;
CREATE POLICY "select_colors" ON colors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_colors" ON colors;
CREATE POLICY "admin_insert_colors" ON colors FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_colors" ON colors;
CREATE POLICY "admin_update_colors" ON colors FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_colors" ON colors;
CREATE POLICY "admin_delete_colors" ON colors FOR DELETE
  TO authenticated USING (public.is_admin());

-- === photochromic_colors junction ===
CREATE TABLE IF NOT EXISTS photochromic_colors (
  photochromic_id uuid NOT NULL REFERENCES photochromics(id) ON DELETE CASCADE,
  color_id uuid NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
  PRIMARY KEY (photochromic_id, color_id)
);

ALTER TABLE photochromic_colors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON photochromic_colors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON photochromic_colors TO authenticated;

DROP POLICY IF EXISTS "select_photochromic_colors" ON photochromic_colors;
CREATE POLICY "select_photochromic_colors" ON photochromic_colors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_photochromic_colors" ON photochromic_colors;
CREATE POLICY "admin_insert_photochromic_colors" ON photochromic_colors FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_photochromic_colors" ON photochromic_colors;
CREATE POLICY "admin_delete_photochromic_colors" ON photochromic_colors FOR DELETE
  TO authenticated USING (public.is_admin());

-- === lenses: new columns (now colors exists) ===
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS ekka text;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS myopia_control boolean NOT NULL DEFAULT false;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS color_id uuid REFERENCES colors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lenses_ekka ON lenses (ekka);
CREATE INDEX IF NOT EXISTS idx_lenses_myopia_control ON lenses (myopia_control);
CREATE INDEX IF NOT EXISTS idx_lenses_color_id ON lenses (color_id);
