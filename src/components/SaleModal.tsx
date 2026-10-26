import { useState } from 'react';
import { supabase, type Lens } from '@/lib/supabase';
import {
  Tag,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Trash2,
  Percent,
  DollarSign,
} from 'lucide-react';

export function SaleModal({
  lens,
  onClose,
  onUpdated,
}: {
  lens: Lens;
  onClose: () => void;
  onUpdated: (updated: Lens) => void;
}) {
  const [onSale, setOnSale] = useState(lens.on_sale);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(
    lens.sale_discount_type === 'amount' ? 'amount' : 'percent'
  );
  const [discountValue, setDiscountValue] = useState<string>(
    lens.sale_discount_value != null ? String(lens.sale_discount_value) : ''
  );
  const [salePrice, setSalePrice] = useState<string>(
    lens.sale_price != null ? String(lens.sale_price) : ''
  );
  const [saleNote, setSaleNote] = useState(lens.sale_note ?? '');
  const [saleEndsAt, setSaleEndsAt] = useState<string>(
    lens.sale_ends_at ? lens.sale_ends_at.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const computedSalePrice = (() => {
    const dv = discountValue.trim() === '' ? null : Number(discountValue);
    if (dv == null || isNaN(dv)) return null;
    if (discountType === 'percent') {
      if (dv <= 0 || dv > 100) return null;
      return Math.round(lens.price * (1 - dv / 100));
    } else {
      if (dv <= 0 || dv >= lens.price) return null;
      return Math.round(lens.price - dv);
    }
  })();

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    if (onSale && saleEndsAt.trim() === '') {
      setError('Дата окончания акции обязательна');
      setSaving(false);
      return;
    }

    const dv = discountValue.trim() === '' ? null : Number(discountValue);
    if (onSale && dv == null && salePrice.trim() === '') {
      setError('Укажите скидку (процент или сумму) или фиксированную цену');
      setSaving(false);
      return;
    }
    if (onSale && dv != null && isNaN(dv)) {
      setError('Скидка должна быть числом');
      setSaving(false);
      return;
    }
    if (onSale && dv != null && discountType === 'percent' && (dv <= 0 || dv > 100)) {
      setError('Процент скидки должен быть от 1 до 100');
      setSaving(false);
      return;
    }
    if (onSale && dv != null && discountType === 'amount' && (dv <= 0 || dv >= lens.price)) {
      setError('Сумма скидки должна быть меньше цены линзы');
      setSaving(false);
      return;
    }

    const priceNum = salePrice.trim() === '' ? null : Number(salePrice);
    if (priceNum !== null && (isNaN(priceNum) || priceNum < 0)) {
      setError('Акционная цена должна быть числом больше 0');
      setSaving(false);
      return;
    }

    const finalPrice = priceNum !== null ? priceNum : computedSalePrice;
    const endsAt = saleEndsAt.trim() === '' ? null : new Date(saleEndsAt + 'T23:59:59').toISOString();

    const updates: Partial<Lens> = {
      on_sale: onSale,
      sale_price: onSale ? finalPrice : null,
      sale_note: onSale ? (saleNote.trim() || null) : null,
      sale_ends_at: onSale ? endsAt : null,
      sale_discount_type: onSale ? discountType : null,
      sale_discount_value: onSale ? (dv ?? null) : null,
    };

    const { data, error } = await supabase
      .from('lenses')
      .update(updates)
      .eq('id', lens.id)
      .select()
      .maybeSingle();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else if (data) {
      setDone(true);
      setTimeout(() => {
        onUpdated(data as Lens);
      }, 800);
    } else {
      setError('Не удалось сохранить акцию. Проверьте, что вы вошли как администратор.');
      setSaving(false);
    }
  };

  const handleRemoveSale = async () => {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('lenses')
      .update({
        on_sale: false,
        sale_price: null,
        sale_note: null,
        sale_ends_at: null,
        sale_discount_type: null,
        sale_discount_value: null,
      })
      .eq('id', lens.id)
      .select()
      .maybeSingle();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else if (data) {
      setDone(true);
      setTimeout(() => {
        onUpdated(data as Lens);
      }, 800);
    } else {
      setError('Не удалось снять акцию. Проверьте, что вы вошли как администратор.');
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100';
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Управление акцией</h2>
              <p className="text-xs text-slate-500">
                {lens.brand} — {lens.name}
              </p>
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
              <p className="text-base font-semibold text-slate-900">Сохранено</p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Акция активна</p>
                  <p className="text-xs text-slate-400">
                    Включите, чтобы выделить линзу в каталоге
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOnSale(!onSale)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    onSale ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      onSale ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              {onSale && (
                <>
                  {/* Discount type selector */}
                  <div>
                    <label className={labelClass}>Тип скидки</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          discountType === 'percent'
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Percent className="h-4 w-4" />
                        Процент
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('amount')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          discountType === 'amount'
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <DollarSign className="h-4 w-4" />
                        Сумма
                      </button>
                    </div>
                  </div>

                  {/* Discount value */}
                  <div>
                    <label className={labelClass}>
                      {discountType === 'percent' ? 'Скидка (%)' : 'Скидка (сумма)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === 'percent' ? 'Например: 20' : 'Например: 500'}
                        className={inputClass}
                      />
                      {discountType === 'percent' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                      )}
                    </div>
                    {computedSalePrice != null && (
                      <p className="mt-1 text-xs text-slate-400">
                        Итоговая цена: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(computedSalePrice)}
                        {' '}из {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(lens.price)}
                      </p>
                    )}
                  </div>

                  {/* Optional manual sale price override */}
                  <div>
                    <label className={labelClass}>
                      Фиксированная цена (необязательно)
                    </label>
                    <input
                      type="number"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="Своё значение цены"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Перекрывает расчётную цену. Обычная цена: {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(lens.price)}
                    </p>
                  </div>

                  {/* Sale note */}
                  <div>
                    <label className={labelClass}>Условия акции</label>
                    <textarea
                      value={saleNote}
                      onChange={(e) => setSaleNote(e.target.value)}
                      rows={3}
                      placeholder="Например: Скидка 20% при заказе от 2 штук"
                      className={`resize-none ${inputClass}`}
                    />
                  </div>

                  {/* Sale end date - required */}
                  <div>
                    <label className={`${labelClass} flex items-center gap-1.5`}>
                      <Calendar className="h-3.5 w-3.5" />
                      Дата окончания акции <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={saleEndsAt}
                      onChange={(e) => setSaleEndsAt(e.target.value)}
                      required
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-rose-400">
                      Обязательное поле — без даты акция не сохранится
                    </p>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {lens.on_sale && (
                  <button
                    onClick={handleRemoveSale}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Снять акцию
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="ml-auto flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
