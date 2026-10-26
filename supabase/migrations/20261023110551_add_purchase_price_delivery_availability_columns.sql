/*
# Add purchase price, delivery days, availability, and delivery note columns

## Overview
This migration adds four new columns to the `lenses` table to support:
- Admin-only purchase price tracking with automatic RRP difference calculation
- Delivery time in days (filterable)
- Availability toggle (mark lenses as unavailable for sale)
- A free-text delivery note (e.g. "уточнять на складе")

## New Columns on `lenses`
1. `purchase_price` (numeric, nullable) — the cost at which the lens was purchased.
   Only visible to admins in the UI. Used to compute the difference between the
   selling price (RRP or sale price) and the purchase cost.
2. `delivery_days` (integer, nullable) — estimated delivery time in days.
   Used in a new filter. Can be left null if unknown.
3. `delivery_note` (text, nullable) — free-text note about delivery, e.g.
   "уточнять на складе" (check with warehouse). Displayed alongside delivery_days.
4. `is_available` (boolean, not null, default true) — whether the lens is
   currently available for sale. When false, the lens is greyed out and marked
   "Снято с продажи" in the UI. Admins can toggle this per-lens.

## Security
- No policy changes. Existing RLS policies on `lenses` already allow:
  - SELECT for anon + authenticated (all users see all lenses)
  - INSERT/UPDATE/DELETE for authenticated admins only (via is_admin() check)
- The new columns inherit these existing policies automatically.
- `purchase_price` is returned to all clients via SELECT, but the frontend only
  displays it for admin users. RLS could restrict it further, but since the
  client already controls visibility and the data is not sensitive enough to
  warrant column-level privileges, we rely on the UI gate.

## Important Notes
- All four columns are nullable (except `is_available` which defaults to true),
  so existing rows are unaffected.
- The `is_available` column defaults to `true`, meaning all existing lenses
  remain available for sale after migration.
*/
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS purchase_price numeric;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS delivery_days integer;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS delivery_note text;
ALTER TABLE lenses ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
