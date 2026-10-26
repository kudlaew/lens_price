/*
# Create lenses table (single-tenant, no auth)

1. New Tables
- `lenses` — каталог очковых линз от разных производителей
  - `id` (uuid, primary key)
  - `brand` (text) — производитель (Essilor, Zeiss, Hoya, и т.д.)
  - `name` (text) — название линзы / серия
  - `design` (text) — дизайн (сферическая, асферическая, лентикулярная)
  - `material` (text) — материал (минеральная, полимерная 1.5, 1.6, 1.67, 1.74)
  - `index` (numeric) — индекс преломления (1.5, 1.6, 1.67, 1.74)
  - `coating` (text[]) — покрытия (антиблик, упрочнение, УФ-фильтр, антиблик+упрочнение, и т.д.) — массив
  - `photochromic` (boolean) — фотохромная линза
  - `photochromic_type` (text) — тип фотохрома (Transitions, PhotoFusion, etc.)
  - `progressive` (boolean) — прогрессивная линза
  - `progressive_corridor` (text) — коридор прогрессии (Standard, Short, Individual)
  - `lens_type` (text) — тип: однофокальная / прогрессивная / бифокальная / офисная
  - `sph_range` (text) — диапазон сферической коррекции (например "+10.00 до -10.00")
  - `cyl_range` (text) — диапазон цилиндра (например "до -4.00")
  - `diameter` (int[]) — доступные диаметры (60, 65, 70, 75)
  - `price` (numeric) — цена в рублях
  - `currency` (text, default 'RUB')
  - `notes` (text) — примечания
  - `created_at` (timestamp)

2. Security
- Enable RLS on `lenses`.
- Grant CRUD to `anon` + `authenticated` — прайс-лист публичный, без входа.
- Allow anon + authenticated CRUD — данные намеренно публичные.

3. Indexes
- index on `brand` — частый фильтр
- index on `lens_type` — частый фильтр
- index on `index` — частый фильтр
- index on `progressive` — частый фильтр
- index on `photochromic` — частый фильтр
*/

CREATE TABLE IF NOT EXISTS lenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  name text NOT NULL,
  design text,
  material text,
  index numeric,
  coating text[] DEFAULT '{}',
  photochromic boolean DEFAULT false,
  photochromic_type text,
  progressive boolean DEFAULT false,
  progressive_corridor text,
  lens_type text DEFAULT 'Однофокальная',
  sph_range text,
  cyl_range text,
  diameter int[] DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'RUB',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON lenses TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_lenses" ON lenses;
CREATE POLICY "anon_select_lenses" ON lenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lenses" ON lenses;
CREATE POLICY "anon_insert_lenses" ON lenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_lenses" ON lenses;
CREATE POLICY "anon_update_lenses" ON lenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lenses" ON lenses;
CREATE POLICY "anon_delete_lenses" ON lenses FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_lenses_brand ON lenses (brand);
CREATE INDEX IF NOT EXISTS idx_lenses_lens_type ON lenses (lens_type);
CREATE INDEX IF NOT EXISTS idx_lenses_index ON lenses (index);
CREATE INDEX IF NOT EXISTS idx_lenses_progressive ON lenses (progressive);
CREATE INDEX IF NOT EXISTS idx_lenses_photochromic ON lenses (photochromic);
