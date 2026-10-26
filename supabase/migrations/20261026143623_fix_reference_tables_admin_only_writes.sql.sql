-- Restrict reference table writes to admins only (matching lenses/colors pattern)
-- manufacturers
DROP POLICY IF EXISTS "insert_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "update_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "delete_manufacturers" ON manufacturers;
CREATE POLICY "admin_insert_manufacturers" ON manufacturers FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_manufacturers" ON manufacturers FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_manufacturers" ON manufacturers FOR DELETE
  TO authenticated USING (public.is_admin());

-- product_lines
DROP POLICY IF EXISTS "insert_product_lines" ON product_lines;
DROP POLICY IF EXISTS "update_product_lines" ON product_lines;
DROP POLICY IF EXISTS "delete_product_lines" ON product_lines;
CREATE POLICY "admin_insert_product_lines" ON product_lines FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_product_lines" ON product_lines FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_product_lines" ON product_lines FOR DELETE
  TO authenticated USING (public.is_admin());

-- coatings
DROP POLICY IF EXISTS "insert_coatings" ON coatings;
DROP POLICY IF EXISTS "update_coatings" ON coatings;
DROP POLICY IF EXISTS "delete_coatings" ON coatings;
CREATE POLICY "admin_insert_coatings" ON coatings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_coatings" ON coatings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_coatings" ON coatings FOR DELETE
  TO authenticated USING (public.is_admin());

-- photochromics
DROP POLICY IF EXISTS "insert_photochromics" ON photochromics;
DROP POLICY IF EXISTS "update_photochromics" ON photochromics;
DROP POLICY IF EXISTS "delete_photochromics" ON photochromics;
CREATE POLICY "admin_insert_photochromics" ON photochromics FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_photochromics" ON photochromics FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_photochromics" ON photochromics FOR DELETE
  TO authenticated USING (public.is_admin());
