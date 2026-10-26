/*
# Add promotion/sale columns to lenses

1. Modified Tables
- `lenses`
  - `on_sale` (boolean, default false) — признак: линза сейчас в акции
  - `sale_price` (numeric, nullable) — акционная цена (если null, акция без изменения цены — только примечание)
  - `sale_note` (text, nullable) — описание условий акции (например "Скидка 20% до конца месяца")
  - `sale_ends_at` (timestamptz, nullable) — дата окончания акции (когда акция истекает)

2. Security
- Без изменений (RLS уже включён, гранты уже выданы на все CRUD операции).

3. Notes
- Акция может быть без изменения цены (sale_price = null) — просто примечание.
- Если sale_ends_at в прошлом, фронтенд автоматически считает акцию истекшей.
- Индекс на on_sale для быстрой фильтрации.
*/

ALTER TABLE lenses ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sale_price numeric;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sale_note text;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lenses_on_sale ON lenses (on_sale);
