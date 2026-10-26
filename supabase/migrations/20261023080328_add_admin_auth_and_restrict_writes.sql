/*
# Add admin authentication and restrict lens writes to admins

## Overview
This migration adds an admin role system. Regular users can view lenses (read-only).
Only admin users can create, update, and delete lenses. The admin flag is stored in
the user's JWT `raw_app_meta_data` (user-immutable), not in `raw_user_meta_data`.

## 1. New Function: is_admin()
- SECURITY DEFINER function that reads `raw_app_meta_data ->> 'is_admin'` from the
  current user's JWT.
- Returns true only if the authenticated user has `is_admin = true` in their JWT.
- Used in RLS policies to gate write operations.

## 2. Security Changes
- `lenses` SELECT policy: unchanged — all users (anon + authenticated) can read.
- `lenses` INSERT/UPDATE/DELETE policies: replaced with admin-only policies.
  Only authenticated users where `is_admin()` returns true can write.
- `lenses` grants: anon gets SELECT only; authenticated gets SELECT; 
  authenticated also gets INSERT, UPDATE, DELETE (gated by RLS to admins only).

## 3. Important Notes
- To make a user an admin, set their `raw_app_meta_data` via the Supabase dashboard
  or SQL: `UPDATE auth.users SET raw_app_meta_data = '{"is_admin": true}' WHERE email = '...';`
- The first admin must be set manually after sign-up.
- Regular (non-admin) users see lenses but cannot modify them.
*/

-- is_admin function: checks if the current user has is_admin=true in their JWT
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'raw_app_meta_data' ->> 'is_admin')::boolean,
    false
  );
$$;

-- Revoke default EXECUTE from PUBLIC, then grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- === lenses: keep SELECT public, restrict writes to admin ===

-- Drop old open policies
DROP POLICY IF EXISTS "anon_delete_lenses" ON lenses;
DROP POLICY IF EXISTS "anon_insert_lenses" ON lenses;
DROP POLICY IF EXISTS "anon_select_lenses" ON lenses;
DROP POLICY IF EXISTS "anon_update_lenses" ON lenses;

-- Re-grant: anon gets SELECT only; authenticated gets SELECT + writes (gated by RLS)
GRANT SELECT ON lenses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON lenses TO authenticated;

-- SELECT: everyone can read
CREATE POLICY "select_lenses" ON lenses FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: admin only
CREATE POLICY "admin_insert_lenses" ON lenses FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- UPDATE: admin only
CREATE POLICY "admin_update_lenses" ON lenses FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- DELETE: admin only
CREATE POLICY "admin_delete_lenses" ON lenses FOR DELETE
  TO authenticated USING (public.is_admin());
