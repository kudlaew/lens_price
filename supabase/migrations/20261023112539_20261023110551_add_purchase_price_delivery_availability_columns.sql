/*
# Add purchase price, delivery days, availability, and delivery note columns

1. New Columns on `lenses`
- `purchase_price` (numeric, nullable) — admin-only purchase cost
- `delivery_days` (integer, nullable) — estimated delivery time in days, filterable
- `delivery_note` (text, nullable) — free-text note about delivery
- `is_available` (boolean, not null, default true) — whether the lens is available for sale

2. Security
- No policy changes. Existing RLS policies already cover these columns.
*/
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS purchase_price numeric;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS delivery_days integer;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS delivery_note text;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
