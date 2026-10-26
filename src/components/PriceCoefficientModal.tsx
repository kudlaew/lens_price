import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Percent,
  TrendingUp,
} from 'lucide-react';

export function PriceCoefficientModal({
  brandFilter,
  availableBrands,
  onClose,
  onUpdated,
}: {
  brandFilter: string[];
  availableBrands: string[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [scope, setScope] = useState<'all' | 'brand'>('all');
  const [selectedBrand, setSelectedBrand] = useState(brandFilter[0] ?? availableBrands[0] ?? '');
  const [coefficient, setCoefficient] = useState('');
  const [operation, setOperation] = useState<'multiply' | 'add'>('multiply');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [affectedCount, setAffectedCount] = useState(0);

  const handleSubmit = async () => {
    const coeff = Number(coefficient);
    if (isNaN(coeff)) {
      setError('Введите число');
      return;
    }
    if (operation === 'multiply' && coeff <= 0) {
      setError('Коэффициент должен быть больше 0');
      return;
    }

    setSaving(true);
    setError(null);

    let query = supabase.from('lenses').select('id, price');
    if (scope === 'brand' && selectedBrand) {
      query = query.eq('brand', selectedBrand);
    }

    const { data: lenses, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      setSaving(false);
      return;
    }
    if (!lenses || lenses.length === 0) {
      setError('Не найдено линз для изменения');
      setSaving(false);
      return;
    }

    const updates = lenses.map((l: { id: string; price: number }) => {
      let newPrice: number;
      if (operation === 'multiply') {
        newPrice = Math.round(l.price * coeff);
      } else {
        newPrice = Math.round(l.price + coeff);
      }
      if (newPrice < 0) newPrice = 0;
      return { id: l.id, price: newPrice };
    });

    setAffectedCount(updates.length);

    let successCount = 0;
    let lastError: string | null = null;

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('lenses')
        .update({ price: update.price })
        .eq('id', update.id);
      if (updateError) {
        lastError = updateError.message;
      } else {
        successCount++;
      }
    }

    if (lastError && successCount === 0) {
      setError(lastError);
      setSaving(false);
    } else {
      setDone(true);
      setTimeout(() => {
        onUpdated();
        onClose();
      }, 1000);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

  const previewText = () => {
    const coeff = Number(coefficient);
    if (isNaN(coeff)) return '';
    if (operation === 'multiply') {
      const pct = Math.round((coeff - 1) * 100);
      return pct >= 0 ? `Повышение на ${pct}%` : `Снижение на ${Math.abs(pct)}%`;
    }
    return coeff >= 0 ? `+${coeff} ₽` : `${coeff} ₽`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Изменение цен</h2>
              <p className="text-xs text-slate-500">Коэффициент для всех или бренда</p>
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
              <p className="text-base font-semibold text-slate-900">Цены обновлены</p>
              <p className="mt-1 text-sm text-slate-500">Изменено {affectedCount} линз</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scope */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Область применения
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScope('all')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      scope === 'all'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Все линзы
                  </button>
                  <button
                    onClick={() => setScope('brand')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      scope === 'brand'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    По бренду
                  </button>
                </div>
              </div>

              {scope === 'brand' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Бренд
                  </label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className={inputClass}
                  >
                    {(brandFilter.length > 0 ? brandFilter : availableBrands).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Operation */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Тип изменения
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOperation('multiply')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      operation === 'multiply'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Percent className="mr-1 inline h-3.5 w-3.5" />%
                  </button>
                  <button
                    onClick={() => setOperation('add')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      operation === 'add'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    +/− ₽
                  </button>
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {operation === 'multiply'
                    ? 'Коэффициент (1.1 = +10%, 0.9 = −10%)'
                    : 'Сумма изменения в рублях'}
                </label>
                <input
                  type="number"
                  step={operation === 'multiply' ? '0.01' : '100'}
                  value={coefficient}
                  onChange={(e) => setCoefficient(e.target.value)}
                  placeholder={operation === 'multiply' ? '1.10' : '500'}
                  className={inputClass}
                />
                {previewText() && (
                  <p className="mt-1.5 text-sm font-medium text-blue-600">{previewText()}</p>
                )}
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
                  disabled={!coefficient || saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  Применить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
