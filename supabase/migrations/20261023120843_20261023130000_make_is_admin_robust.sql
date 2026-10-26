/*
# Make is_admin() robust against stale JWT

## Overview
The is_admin() function currently only reads raw_app_meta_data from the JWT.
If the JWT was issued before is_admin was set to true, the function returns
false even though the user is an admin in the database. This fix adds a
fallback that queries auth.users directly using auth.uid().

## Changes
- is_admin() now checks JWT first, then falls back to auth.users table.
- Still SECURITY DEFINER, still STABLE.
- No policy or grant changes.
*/
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'raw_app_meta_data' ->> 'is_admin')::boolean,
    (SELECT (raw_app_meta_data ->> 'is_admin')::boolean FROM auth.users WHERE id = auth.uid()),
    false
  );
$$;
