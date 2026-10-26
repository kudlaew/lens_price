import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { formatPower, validatePowerRange, type LensPowerRange, type PowerPair } from '@/lib/lens-power-ranges';
import { Check, Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';

type RangeDraft = {
  id?: string;
  sph_min: string;
  sph_max: string;
  sph_step: string;
  cyl_min: string;
  cyl_max: string;
  cyl_step: string;
  allowed_combinations: string;
};

const blankRange: RangeDraft = {
  sph_min: '', sph_max: '', sph_step: '0.25', cyl_min: '', cyl_max: '', cyl_step: '0.25', allowed_combinations: '',
};

function toDraft(range: LensPowerRange): RangeDraft {
  return {
    id: range.id,
    sph_min: String(range.sph_min), sph_max: String(range.sph_max), sph_step: String(range.sph_step),
    cyl_min: String(range.cyl_min), cyl_max: String(range.cyl_max), cyl_step: String(range.cyl_step),
    allowed_combinations: range.allowed_combinations.map((pair) => `${formatPower(pair.sph)}/${formatPower(pair.cyl)}`).join(', '),
  };
}

function parsePairs(value: string): PowerPair[] | null {
  if (!value.trim()) return [];
  const pairs: PowerPair[] = [];
  for (const item of value.split(/[;,]/).map((part) => part.trim()).filter(Boolean)) {
    const [sph, cyl] = item.split(/[/:]/).map((part) => Number(part.trim().replace(',', '.')));
    if (!Number.isFinite(sph) || !Number.isFinite(cyl)) return null;
    pairs.push({ sph, cyl });
  }
  return pairs;
}

function draftToPayload(draft: RangeDraft, lensId: string): { payload: Omit<LensPowerRange, 'id' | 'created_at'>; error: string | null } {
  const pairs = parsePairs(draft.allowed_combinations);
  if (!pairs) return { payload: {} as Omit<LensPowerRange, 'id' | 'created_at'>, error: 'Точные пары укажите в формате SPH/CYL, например -4.00/-2.00' };
  const payload = {
    lens_id: lensId,
    sph_min: Number(draft.sph_min.replace(',', '.')),
    sph_max: Number(draft.sph_max.replace(',', '.')),
    sph_step: Number(draft.sph_step.replace(',', '.')),
    cyl_min: Number(draft.cyl_min.replace(',', '.')),
    cyl_max: Number(draft.cyl_max.replace(',', '.')),
    cyl_step: Number(draft.cyl_step.replace(',', '.')),
    allowed_combinations: pairs,
  };
  return { payload, error: validatePowerRange(payload) };
}

export function LensPowerRangesEditor({ lensId }: { lensId: string | null }) {
  const [ranges, setRanges] = useState<RangeDraft[]>([]);
  const [loading, setLoading] = useState(Boolean(lensId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<RangeDraft[] | null>(null);

  useEffect(() => {
    if (!lensId) return;
    let active = true;
    Promise.resolve(supabase.from('lens_power_ranges').select('*').eq('lens_id', lensId).order('created_at')).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setRanges((data as LensPowerRange[] | null)?.map(toDraft) ?? []);
      setLoading(false);
    }).catch((networkError: unknown) => {
      if (!active) return;
      setMessage(networkError instanceof Error ? networkError.message : 'Нет соединения с базой');
      setLoading(false);
    });
    return () => { active = false; };
  }, [lensId]);

  const update = (index: number, key: keyof RangeDraft, value: string) => {
    setRanges((current) => current.map((range, i) => i === index ? { ...range, [key]: value } : range));
  };

  const save = async () => {
    if (!lensId) return;
    setSaving(true);
    setMessage(null);
    const payloads = ranges.map((range) => draftToPayload(range, lensId));
    const invalid = payloads.find((item) => item.error);
    if (invalid?.error) { setMessage(invalid.error); setSaving(false); return; }
    const { error: deleteError } = await supabase.from('lens_power_ranges').delete().eq('lens_id', lensId);
    if (deleteError) { setMessage(deleteError.message); setSaving(false); return; }
    if (payloads.length > 0) {
      const { error: insertError } = await supabase.from('lens_power_ranges').insert(payloads.map((item) => item.payload));
      if (insertError) { setMessage(insertError.message); setSaving(false); return; }
    }
    setMessage('Диапазоны сохранены');
    setSaving(false);
  };

  const downloadTemplate = () => {
    const rows = [
      ['SPH минимум', 'SPH максимум', 'Шаг SPH', 'CYL минимум', 'CYL максимум', 'Шаг CYL', 'Точные пары SPH/CYL'],
      [-8, 4, 0.25, -4, 0, 0.25, ''],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Диапазоны');
    XLSX.writeFile(workbook, 'шаблон_диапазонов_sph_cyl.xlsx');
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const imported = rows.map((row) => ({
          ...blankRange,
          sph_min: String(row['SPH минимум'] ?? row['sph_min'] ?? ''),
          sph_max: String(row['SPH максимум'] ?? row['sph_max'] ?? ''),
          sph_step: String(row['Шаг SPH'] ?? row['sph_step'] ?? '0.25'),
          cyl_min: String(row['CYL минимум'] ?? row['cyl_min'] ?? ''),
          cyl_max: String(row['CYL максимум'] ?? row['cyl_max'] ?? ''),
          cyl_step: String(row['Шаг CYL'] ?? row['cyl_step'] ?? '0.25'),
          allowed_combinations: String(row['Точные пары SPH/CYL'] ?? row['allowed_combinations'] ?? ''),
        }));
        setImportPreview(imported);
        setMessage(imported.length > 0 ? `Подготовлено строк: ${imported.length}` : 'В файле нет строк');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Не удалось прочитать Excel-файл');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!lensId) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Диапазоны SPH/CYL можно добавить после сохранения новой линзы.</div>;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Диапазоны SPH/CYL</h3>
          <p className="mt-0.5 text-xs text-slate-500">Для точных таблиц укажите пары в формате SPH/CYL через запятую.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><Download className="h-3.5 w-3.5" />Шаблон</button>
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><Upload className="h-3.5 w-3.5" />Импорт<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ''; }} /></label>
          <button onClick={() => setRanges((current) => [...current, { ...blankRange }])} className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"><Plus className="h-3.5 w-3.5" />Строка</button>
        </div>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : ranges.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">Ограничения не заданы. Для этой линзы используются старые общие диапазоны.</p> : (
        <div className="space-y-3">
          {ranges.map((range, index) => (
            <div key={range.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                {(['sph_min', 'sph_max', 'sph_step', 'cyl_min', 'cyl_max', 'cyl_step'] as const).map((key) => (
                  <label key={key} className="text-[11px] font-medium text-slate-500">{key.replace('_', ' ').toUpperCase()}<input type="number" step="0.01" value={range[key]} onChange={(event) => update(index, key, event.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700" /></label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <label className="flex-1 text-[11px] font-medium text-slate-500">ТОЧНЫЕ ПАРЫ SPH/CYL<input value={range.allowed_combinations} onChange={(event) => update(index, 'allowed_combinations', event.target.value)} placeholder="-4.00/-2.00, -5.00/-1.00" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700" /></label>
                <button onClick={() => setRanges((current) => current.filter((_, i) => i !== index))} className="mt-5 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {importPreview && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="mb-2 text-xs font-semibold text-blue-800">Предпросмотр импорта</p><p className="text-xs text-blue-700">{importPreview.length} строк готовы к добавлению.</p><button onClick={() => { setRanges(importPreview); setImportPreview(null); }} className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Добавить в форму</button></div>}
      {message && <p className="mt-3 text-xs text-slate-600">{message}</p>}
      <div className="mt-3 flex justify-end"><button onClick={save} disabled={saving || loading} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Сохранить диапазоны</button></div>
    </section>
  );
}
