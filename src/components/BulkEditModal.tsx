import { useState } from 'react';
import { supabase, type Lens } from '@/lib/supabase';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Layers,
} from 'lucide-react';

type FieldKey =
  | 'brand'
  | 'name'
  | 'design'
  | 'material'
  | 'index'
  | 'lens_type'
  | 'sph_range'
  | 'cyl_range'
  | 'sph_max'
  | 'cyl_max'
  | 'price'
  | 'currency'
  | 'notes'
  | 'coating'
  | 'diameter'
  | 'purchase_price'
  | 'delivery_days'
  | 'delivery_note'
  | 'is_available'
  | 'ekka'
  | 'myopia_control';

const fieldLabels: Record<FieldKey, string> = {
  brand: 'Бренд',
  name: 'Название',
  design: 'Дизайн',
  material: 'Материал',
  index: 'Индекс',
  lens_type: 'Тип линзы',
  sph_range: 'Диапазон сферы',
  cyl_range: 'Диапазон цилиндра',
  sph_max: 'Макс. сфера',
  cyl_max: 'Макс. цилиндр',
  price: 'Цена',
  currency: 'Валюта',
  notes: 'Примечания',
  coating: 'Покрытия (через запятую)',
  diameter: 'Диаметр (через запятую)',
  purchase_price: 'Учётная цена',
  delivery_days: 'Срок поставки (дн.)',
  delivery_note: 'Примечание поставки',
  is_available: 'Доступность',
  ekka: 'ЭККА',
  myopia_control: 'Контроль миопии',
};

const numericFields: FieldKey[] = ['index', 'sph_max', 'cyl_max', 'price', 'purchase_price', 'delivery_days'];
const arrayFields: FieldKey[] = ['coating', 'diameter'];
const booleanFields: FieldKey[] = ['is_available', 'myopia_control'];

export function BulkEditModal({
  lenses,
  onClose,
  onUpdated,
}: {
  lenses: Lens[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [field, setField] = useState<FieldKey | ''>('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!field) return;
    setSaving(true);
    setError(null);

    let updateValue: unknown;
    if (booleanFields.includes(field)) {
      updateValue = value.trim() === 'true' || value.trim() === '1';
    } else if (numericFields.includes(field)) {
      updateValue = value.trim() === '' ? null : Number(value);
      if (updateValue !== null && isNaN(updateValue as number)) {
        setError('Значение должно быть числом');
        setSaving(false);
        return;
      }
    } else if (arrayFields.includes(field)) {
      if (field === 'coating') {
        updateValue = value.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        updateValue = value.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      }
    } else {
      updateValue = value.trim() || null;
    }

    const ids = lenses.map((l) => l.id);
    const { error } = await supabase
      .from('lenses')
      .update({ [field]: updateValue })
      .in('id', ids);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      setDone(true);
      setTimeout(() => {
        onUpdated();
        onClose();
      }, 800);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Массовое изменение</h2>
              <p className="text-xs text-slate-500">{lenses.length} линз выбрано</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {done ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-slate-900">Изменено {lenses.length} линз</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Поле для изменения
                </label>
                <select
                  value={field}
                  onChange={(e) => setField(e.target.value as FieldKey)}
                  className={inputClass}
                >
                  <option value="">Выберите поле...</option>
                  {(Object.keys(fieldLabels) as FieldKey[]).map((key) => (
                    <option key={key} value={key}>
                      {fieldLabels[key]}
                    </option>
                  ))}
                </select>
              </div>

              {field && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Новое значение: {fieldLabels[field as FieldKey]}
                  </label>
                  {booleanFields.includes(field) ? (
                    <select
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Выберите...</option>
                      {field === 'is_available' ? (
                        <>
                          <option value="true">В продаже</option>
                          <option value="false">Снято с продажи</option>
                        </>
                      ) : (
                        <>
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </>
                      )}
                    </select>
                  ) : field === 'notes' || field === 'delivery_note' ? (
                    <textarea
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      rows={3}
                      className={`resize-none ${inputClass}`}
                      placeholder="Введите новое значение"
                    />
                  ) : (
                    <input
                      type={numericFields.includes(field) ? 'number' : 'text'}
                      step={field === 'index' || field === 'sph_max' || field === 'cyl_max' ? '0.25' : undefined}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Введите новое значение"
                      className={inputClass}
                    />
                  )}
                </div>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Значение будет применено ко всем {lenses.length} выбранным линзам одновременно.
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!field || saving}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Применить к {lenses.length} линзам
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
