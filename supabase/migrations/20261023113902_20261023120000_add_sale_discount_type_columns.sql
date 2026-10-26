/*
# Add sale discount type and value columns

1. New Columns on `lenses`
- `sale_discount_type` (text, nullable) — 'percent' or 'amount'. Indicates whether
  the sale discount is a percentage off or a fixed amount off the regular price.
- `sale_discount_value` (numeric, nullable) — the discount value: percentage number
  (e.g. 20 for 20% off) or fixed amount in the lens currency.

2. Security
- No policy changes. Existing RLS policies already cover these columns.
*/
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sale_discount_type text DEFAULT 'percent';
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS sale_discount_value numeric;
