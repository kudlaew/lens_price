/*
# Create reference tables: manufacturers, product_lines, coatings, photochromics

## Overview
Creates four new reference (справочник) tables that organize lens catalog data
into a proper hierarchy:
  Manufacturer → Product Line → Lens
  Manufacturer → Coating → (linked to Lens)
  Manufacturer → Photochromic → (linked to Lens)

The existing `lenses` table gains nullable foreign keys to these tables.
All existing lens data is preserved — the new columns start as NULL and
existing text columns (brand, coating, photochromic_type) remain intact
for backward compatibility.

## New Tables

### 1. manufacturers
- id (uuid, PK)
- name (text, not null) — название производителя
- country (text) — страна
- logo_url (text) — URL логотипа
- description (text) — описание
- created_at (timestamptz)

### 2. product_lines
- id (uuid, PK)
- manufacturer_id (uuid, FK → manufacturers.id ON DELETE CASCADE)
- name (text, not null) — название линейки (Alize, Bi-Aspheric, Progressive…)
- lens_type (text) — тип линзы: однофокальная / прогрессивная / офисная / для дали / для близи
- description (text)
- created_at (timestamptz)

### 3. coatings
- id (uuid, PK)
- manufacturer_id (uuid, FK → manufacturers.id ON DELETE CASCADE)
- name (text, not null) — название покрытия (Crizal Sapphire HR, Diamond Finish…)
- type (text) — тип: антиблик / упрочняющее / грязеотталкивающее / антистатик / УФ / комбинированное
- description (text) — полный текст для tooltip
- advantages (text[]) — список преимуществ
- light_transmission (numeric) — коэффициент светопропускания, %
- residual_reflection_color (text) — цвет остаточного отблеска
- created_at (timestamptz)

### 4. photochromics
- id (uuid, PK)
- manufacturer_id (uuid, FK → manufacturers.id ON DELETE CASCADE)
- name (text, not null) — название (Transitions Signature Gen 8, PhotoFusion X…)
- description (text) — описание свойств
- available_colors (text[]) — доступные цвета (серый, коричневый, графит, зелёный, синий)
- activation_time_sec (integer) — время активации, сек
- fading_time_sec (integer) — время просветления, сек
- darkness_category (integer) — степень затемнения (0-3)
- uv_protection (boolean) — УФ-защита
- created_at (timestamptz)

## Modified Tables

### lenses
Added nullable foreign keys (all existing data preserved):
- manufacturer_id (uuid, FK → manufacturers.id ON DELETE SET NULL)
- product_line_id (uuid, FK → product_lines.id ON DELETE SET NULL)
- coating_id (uuid, FK → coatings.id ON DELETE SET NULL)
- photochromic_id (uuid, FK → photochromics.id ON DELETE SET NULL)

## Security
- RLS enabled on all new tables.
- Grants: SELECT to anon + authenticated (catalog is publicly readable).
- INSERT/UPDATE/DELETE: authenticated only (admin manages reference data).
- service_role gets full CRUD on all new tables.
- Existing lenses table policies unchanged; new columns are nullable so existing
  INSERT/UPDATE policies still work.
*/

-- ============================================================
-- 1. manufacturers
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  logo_url text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON manufacturers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON manufacturers TO authenticated, service_role;

DROP POLICY IF EXISTS "read_manufacturers" ON manufacturers;
CREATE POLICY "read_manufacturers" ON manufacturers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_manufacturers" ON manufacturers;
CREATE POLICY "insert_manufacturers" ON manufacturers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_manufacturers" ON manufacturers;
CREATE POLICY "update_manufacturers" ON manufacturers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_manufacturers" ON manufacturers;
CREATE POLICY "delete_manufacturers" ON manufacturers FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. product_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS product_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  name text NOT NULL,
  lens_type text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON product_lines TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON product_lines TO authenticated, service_role;

DROP POLICY IF EXISTS "read_product_lines" ON product_lines;
CREATE POLICY "read_product_lines" ON product_lines FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_lines" ON product_lines;
CREATE POLICY "insert_product_lines" ON product_lines FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_product_lines" ON product_lines;
CREATE POLICY "update_product_lines" ON product_lines FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_product_lines" ON product_lines;
CREATE POLICY "delete_product_lines" ON product_lines FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. coatings
-- ============================================================
CREATE TABLE IF NOT EXISTS coatings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  description text,
  advantages text[] DEFAULT '{}',
  light_transmission numeric,
  residual_reflection_color text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coatings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON coatings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON coatings TO authenticated, service_role;

DROP POLICY IF EXISTS "read_coatings" ON coatings;
CREATE POLICY "read_coatings" ON coatings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_coatings" ON coatings;
CREATE POLICY "insert_coatings" ON coatings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_coatings" ON coatings;
CREATE POLICY "update_coatings" ON coatings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_coatings" ON coatings;
CREATE POLICY "delete_coatings" ON coatings FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. photochromics
-- ============================================================
CREATE TABLE IF NOT EXISTS photochromics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  available_colors text[] DEFAULT '{}',
  activation_time_sec integer,
  fading_time_sec integer,
  darkness_category integer,
  uv_protection boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photochromics ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON photochromics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON photochromics TO authenticated, service_role;

DROP POLICY IF EXISTS "read_photochromics" ON photochromics;
CREATE POLICY "read_photochromics" ON photochromics FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_photochromics" ON photochromics;
CREATE POLICY "insert_photochromics" ON photochromics FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_photochromics" ON photochromics;
CREATE POLICY "update_photochromics" ON photochromics FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_photochromics" ON photochromics;
CREATE POLICY "delete_photochromics" ON photochromics FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 5. Add FK columns to lenses
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lenses' AND column_name = 'manufacturer_id') THEN
    ALTER TABLE lenses ADD COLUMN manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lenses' AND column_name = 'product_line_id') THEN
    ALTER TABLE lenses ADD COLUMN product_line_id uuid REFERENCES product_lines(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lenses' AND column_name = 'coating_id') THEN
    ALTER TABLE lenses ADD COLUMN coating_id uuid REFERENCES coatings(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lenses' AND column_name = 'photochromic_id') THEN
    ALTER TABLE lenses ADD COLUMN photochromic_id uuid REFERENCES photochromics(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Grant access to new columns on lenses (existing grants cover the table,
-- but column-level re-grant ensures the new columns are accessible)
GRANT SELECT (manufacturer_id, product_line_id, coating_id, photochromic_id) ON lenses TO anon, authenticated;
GRANT INSERT (manufacturer_id, product_line_id, coating_id, photochromic_id) ON lenses TO authenticated;
GRANT UPDATE (manufacturer_id, product_line_id, coating_id, photochromic_id) ON lenses TO authenticated;

-- ============================================================
-- 6. Indexes for FK lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_product_lines_manufacturer ON product_lines(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_coatings_manufacturer ON coatings(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_photochromics_manufacturer ON photochromics(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_lenses_manufacturer ON lenses(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_lenses_product_line ON lenses(product_line_id);
CREATE INDEX IF NOT EXISTS idx_lenses_coating ON lenses(coating_id);
CREATE INDEX IF NOT EXISTS idx_lenses_photochromic ON lenses(photochromic_id);
