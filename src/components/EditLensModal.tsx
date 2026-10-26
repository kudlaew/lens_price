import { useState, useEffect, useMemo } from 'react';
import { supabase, type Lens, type Manufacturer, type ProductLine, type Coating, type Photochromic, type Color } from '@/lib/supabase';
import { LensPowerRangesEditor } from '@/components/LensPowerRangesEditor';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

type Mode = 'edit' | 'create' | 'copy';

export function EditLensModal({
  lens,
  mode,
  onClose,
  onUpdated,
}: {
  lens: Lens | null;
  mode: Mode;
  onClose: () => void;
  onUpdated: (updated: Lens) => void;
}) {
  const [form, setForm] = useState(() => initForm(lens, mode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [coatings, setCoatings] = useState<Coating[]>([]);
  const [photochromics, setPhotochromics] = useState<Photochromic[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [m, pl, c, p, col] = await Promise.all([
          supabase.from('manufacturers').select('*').order('name'),
          supabase.from('product_lines').select('*').order('name'),
          supabase.from('coatings').select('*').order('name'),
          supabase.from('photochromics').select('*').order('name'),
          supabase.from('colors').select('*').order('name'),
        ]);
        if (!active) return;
        const loadError = m.error || pl.error || c.error || p.error || col.error;
        if (loadError) {
          setError(`Не удалось загрузить справочники: ${loadError.message}`);
        } else {
          if (m.data) setManufacturers(m.data as Manufacturer[]);
          if (pl.data) setProductLines(pl.data as ProductLine[]);
          if (c.data) setCoatings(c.data as Coating[]);
          if (p.data) setPhotochromics(p.data as Photochromic[]);
          if (col.data) setColors(col.data as Color[]);
        }
        if (lens) {
          const { data: lensColors, error: lensColorsError } = await supabase.from('lens_colors').select('color_id').eq('lens_id', lens.id);
          if (!active) return;
          if (lensColorsError) {
            setError(`Не удалось загрузить цвета линзы: ${lensColorsError.message}`);
          } else if (lensColors) {
            setForm((prev) => ({ ...prev, color_ids: lensColors.map((row) => row.color_id as string) }));
          }
        }
      } catch (networkError) {
        if (active) {
          setError(`Сетевая ошибка: ${networkError instanceof Error ? networkError.message : 'нет соединения с базой'}`);
        }
      } finally {
        if (active) setLoadingRefs(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filteredLines = useMemo(
    () => form.manufacturer_id ? productLines.filter((pl) => pl.manufacturer_id === form.manufacturer_id) : productLines,
    [productLines, form.manufacturer_id]
  );
  const filteredCoatings = useMemo(
    () => form.manufacturer_id ? coatings.filter((c) => c.manufacturer_id === form.manufacturer_id) : coatings,
    [coatings, form.manufacturer_id]
  );
  const filteredPhotochromics = useMemo(
    () => form.manufacturer_id ? photochromics.filter((p) => p.manufacturer_id === form.manufacturer_id) : photochromics,
    [photochromics, form.manufacturer_id]
  );
  const selectedManufacturer = manufacturers.find((m) => m.id === form.manufacturer_id);
  const selectedProductLine = productLines.find((pl) => pl.id === form.product_line_id);
  const selectedCoating = coatings.find((c) => c.id === form.coating_id);
  const selectedPhotochromic = photochromics.find((photochromic) => photochromic.id === form.photochromic_id);
  const generatedName = selectedManufacturer?.name
    ? [
        selectedManufacturer.name,
        selectedProductLine?.name,
        form.index.trim() ? `1.${form.index.trim().replace(/^1\./, '')}` : null,
        selectedCoating?.name ?? form.coating_text.split(',').map((item) => item.trim()).filter(Boolean).join(', '),
        selectedPhotochromic?.name,
      ].filter(Boolean).join(' ')
    : '';

  const set = (key: keyof typeof form, value: string | boolean | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleManufacturerChange = (mfrId: string) => {
    setForm((prev) => ({
      ...prev,
      manufacturer_id: mfrId,
      product_line_id: '',
      coating_id: '',
      photochromic_id: '',
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const generatedBrand = selectedManufacturer?.name ?? '';
    const generatedTitle = generatedName;
    const payload: Partial<Lens> = {
      brand: generatedBrand,
      name: generatedTitle,
      design: form.design.trim() || null,
      material: form.material.trim() || null,
      index: form.index.trim() === '' ? null : Number(form.index),
      coating: form.coating_text.split(',').map((s) => s.trim()).filter(Boolean),
      photochromic: form.photochromic,
      photochromic_type: form.photochromic ? (form.photochromic_type.trim() || null) : null,
      progressive: form.progressive,
      progressive_corridor: form.progressive ? (form.progressive_corridor.trim() || null) : null,
      lens_type: form.lens_type.trim(),
      sph_range: form.sph_range.trim() || null,
      cyl_range: form.cyl_range.trim() || null,
      sph_max: form.sph_max.trim() === '' ? null : Number(form.sph_max),
      cyl_max: form.cyl_max.trim() === '' ? null : Number(form.cyl_max),
      diameter: form.diameter.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n)),
      price: Number(form.price),
      currency: form.currency.trim() || 'RUB',
      notes: form.notes.trim() || null,
      purchase_price: form.purchase_price.trim() === '' ? null : Number(form.purchase_price),
      delivery_days: form.delivery_days.trim() === '' ? null : Number(form.delivery_days),
      delivery_note: form.delivery_note.trim() || null,
      is_available: form.is_available,
      manufacturer_id: form.manufacturer_id || null,
      product_line_id: form.product_line_id || null,
      coating_id: form.coating_id || null,
      photochromic_id: form.photochromic_id || null,
      color_id: form.color_ids[0] ?? null,
      ekka: form.ekka.trim() || null,
      myopia_control: form.myopia_control,
    };

    if (!payload.brand || !payload.name) {
      setError('Выберите производителя, линейку и укажите индекс');
      setSaving(false);
      return;
    }
    if (isNaN(Number(payload.price))) {
      setError('Цена должна быть числом');
      setSaving(false);
      return;
    }
    if (payload.purchase_price != null && isNaN(Number(payload.purchase_price))) {
      setError('Учётная цена должна быть числом');
      setSaving(false);
      return;
    }
    if (payload.delivery_days != null && isNaN(Number(payload.delivery_days))) {
      setError('Срок поставки должен быть числом');
      setSaving(false);
      return;
    }

    let result;
    if (mode === 'edit' && lens) {
      result = await supabase.from('lenses').update(payload).eq('id', lens.id).select().maybeSingle();
    } else {
      result = await supabase.from('lenses').insert(payload).select().maybeSingle();
    }

    const { data, error: dbError } = result;
    if (dbError) {
      setError(dbError.message);
      setSaving(false);
    } else if (data) {
      const { error: deleteColorsError } = await supabase.from('lens_colors').delete().eq('lens_id', data.id);
      if (deleteColorsError) {
        setError(deleteColorsError.message);
        setSaving(false);
        return;
      }
      if (form.color_ids.length > 0) {
        const { error: insertColorsError } = await supabase.from('lens_colors').insert(
          form.color_ids.map((colorId) => ({ lens_id: data.id, color_id: colorId }))
        );
        if (insertColorsError) {
          setError(insertColorsError.message);
          setSaving(false);
          return;
        }
      }
      setDone(true);
      setTimeout(() => onUpdated(data as Lens), 800);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
  const selectClass = inputClass;
  const diameterOptions = Array.from({ length: 31 }, (_, index) => String(index + 50));
  const selectedDiameters = form.diameter.split(',').map((value) => value.trim()).filter(Boolean);
  const diameterSelectOptions = Array.from(new Set([...diameterOptions, ...selectedDiameters])).sort((a, b) => Number(a) - Number(b));

  const title = mode === 'create' ? 'Создать линзу' : mode === 'copy' ? 'Копирование линзы' : 'Редактирование линзы';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {done ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-slate-900">Сохранено</p>
            </div>
          ) : loadingRefs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {mode === 'copy' && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Копия создаётся на основе «{lens?.name}». Измените данные и сохраните.
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <label className={labelClass}>Заголовок</label>
                <p className="text-base font-semibold text-slate-900">
                  {generatedName || 'Выберите производителя, линейку и укажите индекс'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Формируется автоматически из справочников и параметров линзы</p>
              </div>

              {/* Reference selectors */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Привязка к справочникам</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Производитель</label>
                    <select
                      value={form.manufacturer_id}
                      onChange={(e) => handleManufacturerChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— не выбран —</option>
                      {manufacturers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Линейка</label>
                    <select
                      value={form.product_line_id}
                      onChange={(e) => set('product_line_id', e.target.value)}
                      className={selectClass}
                      disabled={filteredLines.length === 0}
                    >
                      <option value="">{filteredLines.length === 0 ? '— нет линеек —' : '— не выбрана —'}</option>
                      {filteredLines.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Покрытие</label>
                    <select
                      value={form.coating_id}
                      onChange={(e) => set('coating_id', e.target.value)}
                      className={selectClass}
                      disabled={filteredCoatings.length === 0}
                    >
                      <option value="">{filteredCoatings.length === 0 ? '— нет покрытий —' : '— не выбрано —'}</option>
                      {filteredCoatings.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div
                    title={selectedPhotochromic?.available_colors.length
                      ? `Доступные цвета фотохрома: ${selectedPhotochromic.available_colors.join(', ')}`
                      : 'Для выбранного фотохрома доступные цвета не указаны'}
                  >
                    <label className={labelClass}>Фотохром</label>
                    <select
                      value={form.photochromic_id}
                      onChange={(e) => set('photochromic_id', e.target.value)}
                      className={selectClass}
                      disabled={filteredPhotochromics.length === 0}
                    >
                      <option value="">{filteredPhotochromics.length === 0 ? '— нет фотохромов —' : '— не выбран —'}</option>
                      {filteredPhotochromics.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Доступные цвета</label>
                    {colors.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">Сначала добавьте цвета в справочник</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">
                        {colors.map((color) => (
                          <label key={color.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={form.color_ids.includes(color.id)}
                              onChange={() => set('color_ids', form.color_ids.includes(color.id) ? form.color_ids.filter((id) => id !== color.id) : [...form.color_ids, color.id])}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="h-4 w-4 rounded-full border border-slate-200 opacity-60" style={{ backgroundColor: color.hex ?? '#cbd5e1' }} />
                            <span className="truncate text-slate-500">{color.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Тип линзы</label>
                  <input value={form.lens_type} onChange={(e) => set('lens_type', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Дизайн</label>
                  <input value={form.design} onChange={(e) => set('design', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Материал</label>
                  <input value={form.material} onChange={(e) => set('material', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Индекс</label>
                  <input value={form.index} onChange={(e) => set('index', e.target.value)} placeholder="1.67" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ЭККА</label>
                  <input value={form.ekka} onChange={(e) => set('ekka', e.target.value)} placeholder="Код ЭККА" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Цена</label>
                  <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Учётная цена</label>
                  <input type="number" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="Закупочная цена" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Валюта</label>
                  <input value={form.currency} onChange={(e) => set('currency', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Срок поставки (дн.)</label>
                  <input type="number" value={form.delivery_days} onChange={(e) => set('delivery_days', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Диаметры</label>
                  <select
                    multiple
                    value={selectedDiameters}
                    onChange={(e) => set('diameter', Array.from(e.target.selectedOptions, (option) => option.value).join(', '))}
                    className={`${selectClass} min-h-24`}
                  >
                    {diameterSelectOptions.map((diameter) => (
                      <option key={diameter} value={diameter}>{diameter} мм</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">Можно выбрать несколько значений</p>
                </div>
                <div>
                  <label className={labelClass}>Покрытия (через запятую)</label>
                  <input value={form.coating_text} onChange={(e) => set('coating_text', e.target.value)} placeholder="Упрочнение, Антиблик" className={inputClass} />
                </div>

              </div>

              <LensPowerRangesEditor lensId={mode === 'edit' ? lens?.id ?? null : null} />

              <div>
                <label className={labelClass}>Примечание поставки</label>
                <input value={form.delivery_note} onChange={(e) => set('delivery_note', e.target.value)} className={inputClass} />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.photochromic} onChange={(e) => set('photochromic', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                  Фотохром
                </label>
                {form.photochromic && (
                  <input value={form.photochromic_type} onChange={(e) => set('photochromic_type', e.target.value)} placeholder="Тип фотохрома" className={`flex-1 ${inputClass}`} />
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.progressive} onChange={(e) => set('progressive', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                  Прогрессивная
                </label>
                {form.progressive && (
                  <input value={form.progressive_corridor} onChange={(e) => set('progressive_corridor', e.target.value)} placeholder="Коридор прогрессии" className={`flex-1 ${inputClass}`} />
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.myopia_control} onChange={(e) => set('myopia_control', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                  Контроль миопии
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_available} onChange={(e) => set('is_available', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                  В продаже
                </label>
              </div>

              <div>
                <label className={labelClass}>Примечания</label>
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={`resize-none ${inputClass}`} />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {mode === 'create' ? 'Создать' : mode === 'copy' ? 'Создать копию' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initForm(lens: Lens | null, mode: Mode) {
  if (mode === 'create' || !lens) {
    return {
      brand: '',
      name: '',
      color_ids: [],
      design: '',
      material: '',
      index: '',
      coating_text: '',
      photochromic: false,
      photochromic_type: '',
      progressive: false,
      progressive_corridor: '',
      lens_type: 'Однофокальная',
      sph_range: '',
      cyl_range: '',
      sph_max: '',
      cyl_max: '',
      diameter: '',
      price: '0',
      currency: 'RUB',
      notes: '',
      purchase_price: '',
      delivery_days: '',
      delivery_note: '',
      is_available: true,
      manufacturer_id: '',
      product_line_id: '',
      coating_id: '',
      photochromic_id: '',
      color_id: '',
      ekka: '',
      myopia_control: false,
    };
  }
  return {
    brand: lens.brand,
    name: lens.name,
    color_ids: lens.color_id ? [lens.color_id] : [],
    design: lens.design ?? '',
    material: lens.material ?? '',
    index: lens.index != null ? String(lens.index) : '',
    coating_text: lens.coating.join(', '),
    photochromic: lens.photochromic,
    photochromic_type: lens.photochromic_type ?? '',
    progressive: lens.progressive,
    progressive_corridor: lens.progressive_corridor ?? '',
    lens_type: lens.lens_type,
    sph_range: lens.sph_range ?? '',
    cyl_range: lens.cyl_range ?? '',
    sph_max: lens.sph_max != null ? String(lens.sph_max) : '',
    cyl_max: lens.cyl_max != null ? String(lens.cyl_max) : '',
    diameter: lens.diameter.join(', '),
    price: String(lens.price),
    currency: lens.currency,
    notes: lens.notes ?? '',
    purchase_price: lens.purchase_price != null ? String(lens.purchase_price) : '',
    delivery_days: lens.delivery_days != null ? String(lens.delivery_days) : '',
    delivery_note: lens.delivery_note ?? '',
    is_available: lens.is_available,
    manufacturer_id: lens.manufacturer_id ?? '',
    product_line_id: lens.product_line_id ?? '',
    coating_id: lens.coating_id ?? '',
    photochromic_id: lens.photochromic_id ?? '',
    color_id: lens.color_id ?? '',
    ekka: lens.ekka ?? '',
    myopia_control: lens.myopia_control ?? false,
  };
}
