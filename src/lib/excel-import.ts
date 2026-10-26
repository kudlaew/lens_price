import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import type { Lens } from '@/lib/supabase';

export type ParsedRow = {
  rowNumber: number;
  data: Partial<Lens>;
  warnings: string[];
};

export type ParseResult = {
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errors: string[];
};

const HEADER_MAP: Record<string, keyof Lens> = {
  'бренд': 'brand',
  'производитель': 'brand',
  'brand': 'brand',
  'название': 'name',
  'наименование': 'name',
  'имя': 'name',
  'name': 'name',
  'дизайн': 'design',
  'design': 'design',
  'материал': 'material',
  'material': 'material',
  'индекс': 'index',
  'индекс преломления': 'index',
  'index': 'index',
  'покрытия': 'coating',
  'покрытие': 'coating',
  'coating': 'coating',
  'coatings': 'coating',
  'фотохром': 'photochromic',
  'фотохромная': 'photochromic',
  'photochromic': 'photochromic',
  'тип фотохрома': 'photochromic_type',
  'photochromic_type': 'photochromic_type',
  'прогрессивная': 'progressive',
  'прогрессив': 'progressive',
  'progressive': 'progressive',
  'коридор': 'progressive_corridor',
  'коридор прогрессии': 'progressive_corridor',
  'progressive_corridor': 'progressive_corridor',
  'тип линзы': 'lens_type',
  'lens_type': 'lens_type',
  'диапазон сферы': 'sph_range',
  'sph_range': 'sph_range',
  'диапазон цилиндра': 'cyl_range',
  'cyl_range': 'cyl_range',
  'макс. сфера': 'sph_max',
  'макс сфера': 'sph_max',
  'sph_max': 'sph_max',
  'sph max': 'sph_max',
  'макс. цилиндр': 'cyl_max',
  'макс цилиндр': 'cyl_max',
  'cyl_max': 'cyl_max',
  'cyl max': 'cyl_max',
  'диаметр': 'diameter',
  'диаметры': 'diameter',
  'diameter': 'diameter',
  'цена': 'price',
  'price': 'price',
  'валюта': 'currency',
  'currency': 'currency',
  'примечания': 'notes',
  'примечание': 'notes',
  'notes': 'notes',
};

function parseBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  return s === 'да' || s === 'yes' || s === '1' || s === 'true' || s === '+' || s === 'y';
}

function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val === 'string') {
    return val
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseNumberArray(val: unknown): number[] {
  if (Array.isArray(val)) return val.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (typeof val === 'string') {
    return val
      .split(/[,;|]/)
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
  }
  if (typeof val === 'number') return [val];
  return [];
}

function parseNumber(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/\s/g, '').replace(',', '.');
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ rows: [], totalRows: 0, validRows: 0, errors: ['Файл не содержит листов'] });
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: true,
        });

        if (json.length === 0) {
          resolve({ rows: [], totalRows: 0, validRows: 0, errors: ['Лист пустой'] });
          return;
        }

        const headers = Object.keys(json[0]);
        const columnMap: Record<string, keyof Lens> = {};
        for (const h of headers) {
          const normalized = h.trim().toLowerCase();
          if (HEADER_MAP[normalized]) {
            columnMap[h] = HEADER_MAP[normalized];
          }
        }

        if (columnMap['brand'] === undefined || columnMap['name'] === undefined) {
          resolve({
            rows: [],
            totalRows: json.length,
            validRows: 0,
            errors: [
              'Не найдены обязательные колонки "Бренд" и "Название". Проверьте заголовки в файле.',
            ],
          });
          return;
        }

        const parsedRows: ParsedRow[] = [];
        let validCount = 0;

        json.forEach((rawRow, idx) => {
          const warnings: string[] = [];
          const rowData: Partial<Lens> = {};

          for (const [excelCol, lensField] of Object.entries(columnMap)) {
            const val = rawRow[excelCol];
            if (val === '' || val === null || val === undefined) continue;

            switch (lensField) {
              case 'brand':
              case 'name':
              case 'design':
              case 'material':
              case 'photochromic_type':
              case 'progressive_corridor':
              case 'lens_type':
              case 'sph_range':
              case 'cyl_range':
              case 'currency':
              case 'notes':
                rowData[lensField] = String(val).trim();
                break;
              case 'index':
                rowData.index = parseNumber(val);
                break;
              case 'sph_max':
                rowData.sph_max = parseNumber(val);
                break;
              case 'cyl_max':
                rowData.cyl_max = parseNumber(val);
                break;
              case 'price':
                rowData.price = parseNumber(val) ?? 0;
                break;
              case 'photochromic':
                rowData.photochromic = parseBoolean(val);
                break;
              case 'progressive':
                rowData.progressive = parseBoolean(val);
                break;
              case 'coating':
                rowData.coating = parseStringArray(val);
                break;
              case 'diameter':
                rowData.diameter = parseNumberArray(val);
                break;
            }
          }

          if (!rowData.brand || !rowData.name) {
            warnings.push('Не заполнены бренд или название — строка будет пропущена');
          } else {
            validCount++;
          }

          parsedRows.push({ rowNumber: idx + 2, data: rowData, warnings });
        });

        resolve({
          rows: parsedRows,
          totalRows: json.length,
          validRows: validCount,
          errors: [],
        });
      } catch (err) {
        reject(new Error(`Ошибка чтения файла: ${err instanceof Error ? err.message : String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsArrayBuffer(file);
  });
}

export async function importRowsToSupabase(
  rows: ParsedRow[]
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const validRows = rows.filter((r) => r.data.brand && r.data.name);
  if (validRows.length === 0) {
    return { inserted: 0, failed: 0, errors: ['Нет валидных строк для импорта'] };
  }

  const inserts = validRows.map((r) => ({
    brand: r.data.brand!,
    name: r.data.name!,
    design: r.data.design ?? null,
    material: r.data.material ?? null,
    index: r.data.index ?? null,
    coating: r.data.coating ?? [],
    photochromic: r.data.photochromic ?? false,
    photochromic_type: r.data.photochromic_type ?? null,
    progressive: r.data.progressive ?? false,
    progressive_corridor: r.data.progressive_corridor ?? null,
    lens_type: r.data.lens_type ?? 'Однофокальная',
    sph_range: r.data.sph_range ?? null,
    cyl_range: r.data.cyl_range ?? null,
    sph_max: r.data.sph_max ?? null,
    cyl_max: r.data.cyl_max ?? null,
    diameter: r.data.diameter ?? [],
    price: r.data.price ?? 0,
    currency: r.data.currency ?? 'RUB',
    notes: r.data.notes ?? null,
  }));

  const errors: string[] = [];
  let inserted = 0;
  let failed = 0;

  const batchSize = 50;
  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize);
    const { error } = await supabase.from('lenses').insert(batch);
    if (error) {
      failed += batch.length;
      errors.push(`Строки ${i + 1}–${i + batch.length}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, failed, errors };
}
