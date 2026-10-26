import { createClient } from '@supabase/supabase-js';
import type { LensPowerRange } from '@/lib/lens-power-ranges';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lens = {
  id: string;
  brand: string;
  name: string;
  design: string | null;
  material: string | null;
  index: number | null;
  coating: string[];
  photochromic: boolean;
  photochromic_type: string | null;
  progressive: boolean;
  progressive_corridor: string | null;
  lens_type: string;
  sph_range: string | null;
  cyl_range: string | null;
  sph_max: number | null;
  cyl_max: number | null;
  diameter: number[];
  price: number;
  currency: string;
  notes: string | null;
  created_at: string;
  on_sale: boolean;
  sale_price: number | null;
  sale_note: string | null;
  sale_ends_at: string | null;
  sale_discount_type: 'percent' | 'amount' | null;
  sale_discount_value: number | null;
  purchase_price: number | null;
  delivery_days: number | null;
  delivery_note: string | null;
  is_available: boolean;
  manufacturer_id: string | null;
  product_line_id: string | null;
  coating_id: string | null;
  photochromic_id: string | null;
  ekka: string | null;
  myopia_control: boolean;
  color_id: string | null;
  color_ids?: string[];
  power_ranges?: LensPowerRange[];
};

export type Manufacturer = {
  id: string;
  name: string;
  country: string | null;
  logo_url: string | null;
  description: string | null;
  created_at: string;
};

export type ProductLine = {
  id: string;
  manufacturer_id: string;
  name: string;
  lens_type: string | null;
  description: string | null;
  created_at: string;
};

export type Coating = {
  id: string;
  manufacturer_id: string;
  name: string;
  type: string | null;
  description: string | null;
  advantages: string[];
  light_transmission: number | null;
  residual_reflection_color: string | null;
  created_at: string;
};

export type Photochromic = {
  id: string;
  manufacturer_id: string;
  name: string;
  description: string | null;
  available_colors: string[];
  color_ids?: string[];
  activation_time_sec: number | null;
  fading_time_sec: number | null;
  darkness_category: number | null;
  uv_protection: boolean;
  created_at: string;
};

export type Color = {
  id: string;
  name: string;
  hex: string | null;
  created_at: string;
};

/**
 * Whether a sale is currently active (on_sale flag set AND not past its end date).
 */
export function isSaleActive(lens: Pick<Lens, 'on_sale' | 'sale_ends_at'>): boolean {
  if (!lens.on_sale) return false;
  if (!lens.sale_ends_at) return true;
  return new Date(lens.sale_ends_at) > new Date();
}

/**
 * The final sale price for a lens, if a sale is active and a sale price exists.
 * Returns null when no sale is active or no sale price is set.
 */
export function computeSalePrice(lens: Pick<Lens, 'on_sale' | 'sale_ends_at' | 'sale_price'>): number | null {
  if (!isSaleActive(lens)) return null;
  return lens.sale_price ?? null;
}

/**
 * The display price a customer pays: sale price when an active sale is on,
 * otherwise the regular price.
 */
export function displayPrice(lens: Pick<Lens, 'price' | 'on_sale' | 'sale_ends_at' | 'sale_price'>): number {
  const sp = computeSalePrice(lens);
  return sp != null ? sp : lens.price;
}

/**
 * Разница = актуальная цена продажи − учётная цена.
 * Returns null when purchase price is missing or not a number.
 */
export function priceDifference(
  lens: Pick<Lens, 'price' | 'on_sale' | 'sale_ends_at' | 'sale_price' | 'purchase_price'>
): number | null {
  if (lens.purchase_price == null || isNaN(Number(lens.purchase_price))) return null;
  const sold = displayPrice(lens);
  return Math.round(sold - Number(lens.purchase_price));
}
