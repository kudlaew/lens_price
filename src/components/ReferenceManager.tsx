import { useState, useEffect, useCallback } from 'react';
import { supabase, type Manufacturer, type ProductLine, type Coating, type Photochromic, type Color } from '@/lib/supabase';
import {
  X,
  Building2,
  Layers,
  Eye,
  Sun,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  Palette,
  AlertCircle,
} from 'lucide-react';

type Tab = 'manufacturers' | 'product_lines' | 'coatings' | 'photochromics' | 'colors';

export function ReferenceManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('manufacturers');
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [coatings, setCoatings] = useState<Coating[]>([]);
  const [photochromics, setPhotochromics] = useState<Photochromic[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMfr, setExpandedMfr] = useState<string | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [m, pl, c, p, col, photoColorLinks] = await Promise.all([
        supabase.from('manufacturers').select('*').order('name'),
        supabase.from('product_lines').select('*').order('name'),
        supabase.from('coatings').select('*').order('name'),
        supabase.from('photochromics').select('*').order('name'),
        supabase.from('colors').select('*').order('name'),
        supabase.from('photochromic_colors').select('photochromic_id, color_id'),
      ]);
      if (m.data) setManufacturers(m.data as Manufacturer[]);
      if (pl.data) setProductLines(pl.data as ProductLine[]);
      if (c.data) setCoatings(c.data as Coating[]);
      if (p.data) {
        const colorIdsByPhotochromic = new Map<string, string[]>();
        (photoColorLinks.data ?? []).forEach((link) => {
          const ids = colorIdsByPhotochromic.get(link.photochromic_id as string) ?? [];
          ids.push(link.color_id as string);
          colorIdsByPhotochromic.set(link.photochromic_id as string, ids);
        });
        setPhotochromics((p.data as Photochromic[]).map((photochromic) => ({
          ...photochromic,
          color_ids: colorIdsByPhotochromic.get(photochromic.id) ?? [],
        })));
      }
      if (col.data) setColors(col.data as Color[]);
    } catch (networkError) {
      setError(networkError instanceof Error ? networkError.message : 'Нет соединения с базой');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleChanged = useCallback(() => fetchAll(true), [fetchAll]);

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'manufacturers', label: 'Производители', icon: Building2 },
    { key: 'product_lines', label: 'Линейки', icon: Layers },
    { key: 'coatings', label: 'Покрытия', icon: Eye },
    { key: 'photochromics', label: 'Фотохром', icon: Sun },
    { key: 'colors', label: 'Цвета', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Справочники</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto p-6">
          {refreshing && (
            <div className="absolute right-6 top-6 z-10 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Обновление...
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm font-medium text-red-600">Не удалось загрузить справочники</p>
              <p className="max-w-md text-center text-xs text-slate-500">{error}</p>
              <button
                onClick={() => { setError(null); fetchAll(); }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Повторить
              </button>
            </div>
          ) : (
            <>
              {tab === 'manufacturers' && (
                <ManufacturersTab
                  manufacturers={manufacturers}
                  productLines={productLines}
                  coatings={coatings}
                  photochromics={photochromics}
                  expandedMfr={expandedMfr}
                  onToggleExpand={(id) => setExpandedMfr(expandedMfr === id ? null : id)}
                  onChanged={handleChanged}
                />
              )}
              {tab === 'product_lines' && (
                <ProductLinesTab
                  manufacturers={manufacturers}
                  productLines={productLines}
                  onChanged={handleChanged}
                />
              )}
              {tab === 'coatings' && (
                <CoatingsTab manufacturers={manufacturers} coatings={coatings} onChanged={handleChanged} />
              )}
              {tab === 'photochromics' && (
                <PhotochromicsTab manufacturers={manufacturers} photochromics={photochromics} colors={colors} onChanged={handleChanged} />
              )}
              {tab === 'colors' && <ColorsTab colors={colors} onChanged={handleChanged} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Manufacturers Tab
// ============================================================
function ManufacturersTab({
  manufacturers,
  productLines,
  coatings,
  photochromics,
  expandedMfr,
  onToggleExpand,
  onChanged,
}: {
  manufacturers: Manufacturer[];
  productLines: ProductLine[];
  coatings: Coating[];
  photochromics: Photochromic[];
  expandedMfr: string | null;
  onToggleExpand: (id: string) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{manufacturers.length} производителей</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {(adding || editing) && (
        <ManufacturerForm
          manufacturer={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged(); }}
        />
      )}

      <div className="space-y-2">
        {manufacturers.map((mfr) => {
          const mfrLines = productLines.filter((pl) => pl.manufacturer_id === mfr.id);
          const mfrCoatings = coatings.filter((c) => c.manufacturer_id === mfr.id);
          const mfrPhoto = photochromics.filter((p) => p.manufacturer_id === mfr.id);
          const isExpanded = expandedMfr === mfr.id;
          return (
            <div key={mfr.id} className="rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => onToggleExpand(mfr.id)}
                  className="text-slate-400 transition hover:text-slate-600"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  {mfr.logo_url ? (
                    <img src={mfr.logo_url} alt={mfr.name} className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{mfr.name}</p>
                  <p className="text-xs text-slate-500">
                    {mfr.country ?? '—'}
                    {' · '}
                    {mfrLines.length} линеек, {mfrCoatings.length} покрытий, {mfrPhoto.length} фотохромов
                  </p>
                </div>
                <button
                  onClick={() => setEditing(mfr)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <DeleteButton table="manufacturers" id={mfr.id} onDeleted={onChanged} />
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3">
                  {mfr.description && <p className="mb-3 text-sm text-slate-600">{mfr.description}</p>}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Линейки</p>
                      {mfrLines.length === 0 ? (
                        <p className="text-xs text-slate-400">Нет данных</p>
                      ) : (
                        <ul className="space-y-1">
                          {mfrLines.map((pl) => (
                            <li key={pl.id} className="text-sm text-slate-700">
                              {pl.name}
                              {pl.lens_type && <span className="text-xs text-slate-400"> · {pl.lens_type}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Покрытия</p>
                      {mfrCoatings.length === 0 ? (
                        <p className="text-xs text-slate-400">Нет данных</p>
                      ) : (
                        <ul className="space-y-1">
                          {mfrCoatings.map((c) => (
                            <li key={c.id} className="text-sm text-slate-700">
                              {c.name}
                              {c.type && <span className="text-xs text-slate-400"> · {c.type}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Фотохром</p>
                      {mfrPhoto.length === 0 ? (
                        <p className="text-xs text-slate-400">Нет данных</p>
                      ) : (
                        <ul className="space-y-1">
                          {mfrPhoto.map((p) => (
                            <li key={p.id} className="text-sm text-slate-700">{p.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {manufacturers.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Нет производителей. Нажмите «Добавить».</p>
        )}
      </div>
    </div>
  );
}

function ManufacturerForm({
  manufacturer,
  onClose,
  onSaved,
}: {
  manufacturer: Manufacturer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(manufacturer?.name ?? '');
  const [country, setCountry] = useState(manufacturer?.country ?? '');
  const [logoUrl, setLogoUrl] = useState(manufacturer?.logo_url ?? '');
  const [description, setDescription] = useState(manufacturer?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      country: country.trim() || null,
      logo_url: logoUrl.trim() || null,
      description: description.trim() || null,
    };
    const { error: saveError } = manufacturer
      ? await supabase.from('manufacturers').update(payload).eq('id', manufacturer.id)
      : await supabase.from('manufacturers').insert(payload);
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <FormCard title={manufacturer ? 'Редактировать производителя' : 'Новый производитель'} onClose={onClose}>
      <Field label="Название" value={name} onChange={setName} />
      <Field label="Страна" value={country} onChange={setCountry} />
      <Field label="URL логотипа" value={logoUrl} onChange={setLogoUrl} />
      <Field label="Описание" value={description} onChange={setDescription} multiline />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveBar saving={saving} onSave={save} onCancel={onClose} />
    </FormCard>
  );
}

// ============================================================
// Product Lines Tab
// ============================================================
function ProductLinesTab({
  manufacturers,
  productLines,
  onChanged,
}: {
  manufacturers: Manufacturer[];
  productLines: ProductLine[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ProductLine | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{productLines.length} линеек</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {(adding || editing) && (
        <ProductLineForm
          productLine={editing}
          manufacturers={manufacturers}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged(); }}
        />
      )}

      <div className="space-y-2">
        {productLines.map((pl) => {
          const mfr = manufacturers.find((m) => m.id === pl.manufacturer_id);
          return (
            <div key={pl.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
              <Layers className="h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{pl.name}</p>
                <p className="text-xs text-slate-500">
                  {mfr?.name ?? '—'}
                  {pl.lens_type && ` · ${pl.lens_type}`}
                </p>
                {pl.description && <p className="mt-1 text-sm text-slate-600">{pl.description}</p>}
              </div>
              <button onClick={() => setEditing(pl)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600">
                <Pencil className="h-4 w-4" />
              </button>
              <DeleteButton table="product_lines" id={pl.id} onDeleted={onChanged} />
            </div>
          );
        })}
        {productLines.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Нет линеек. Нажмите «Добавить».</p>
        )}
      </div>
    </div>
  );
}

function ProductLineForm({
  productLine,
  manufacturers,
  onClose,
  onSaved,
}: {
  productLine: ProductLine | null;
  manufacturers: Manufacturer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(productLine?.name ?? '');
  const [manufacturerId, setManufacturerId] = useState(productLine?.manufacturer_id ?? manufacturers[0]?.id ?? '');
  const [lensType, setLensType] = useState(productLine?.lens_type ?? '');
  const [description, setDescription] = useState(productLine?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    if (!manufacturerId) { setError('Выберите производителя'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      manufacturer_id: manufacturerId,
      lens_type: lensType.trim() || null,
      description: description.trim() || null,
    };
    const { error: saveError } = productLine
      ? await supabase.from('product_lines').update(payload).eq('id', productLine.id)
      : await supabase.from('product_lines').insert(payload);
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <FormCard title={productLine ? 'Редактировать линейку' : 'Новая линейка'} onClose={onClose}>
      <SelectField label="Производитель" value={manufacturerId} onChange={setManufacturerId} options={manufacturers.map((m) => ({ value: m.id, label: m.name }))} />
      <Field label="Название" value={name} onChange={setName} />
      <Field label="Тип линзы" value={lensType} onChange={setLensType} />
      <Field label="Описание" value={description} onChange={setDescription} multiline />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveBar saving={saving} onSave={save} onCancel={onClose} />
    </FormCard>
  );
}

// ============================================================
// Coatings Tab
// ============================================================
function CoatingsTab({
  manufacturers,
  coatings,
  onChanged,
}: {
  manufacturers: Manufacturer[];
  coatings: Coating[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Coating | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{coatings.length} покрытий</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {(adding || editing) && (
        <CoatingForm
          coating={editing}
          manufacturers={manufacturers}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged(); }}
        />
      )}

      <div className="space-y-2">
        {coatings.map((c) => {
          const mfr = manufacturers.find((m) => m.id === c.manufacturer_id);
          return (
            <div key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <Eye className="mt-0.5 h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {mfr?.name ?? '—'}
                  {c.type && ` · ${c.type}`}
                  {c.light_transmission != null && ` · ${c.light_transmission}% светопропускания`}
                </p>
                {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
                {c.advantages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.advantages.map((a, i) => (
                      <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(c)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600">
                <Pencil className="h-4 w-4" />
              </button>
              <DeleteButton table="coatings" id={c.id} onDeleted={onChanged} />
            </div>
          );
        })}
        {coatings.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Нет покрытий. Нажмите «Добавить».</p>
        )}
      </div>
    </div>
  );
}

function CoatingForm({
  coating,
  manufacturers,
  onClose,
  onSaved,
}: {
  coating: Coating | null;
  manufacturers: Manufacturer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(coating?.name ?? '');
  const [manufacturerId, setManufacturerId] = useState(coating?.manufacturer_id ?? manufacturers[0]?.id ?? '');
  const [type, setType] = useState(coating?.type ?? '');
  const [description, setDescription] = useState(coating?.description ?? '');
  const [advantages, setAdvantages] = useState(coating?.advantages.join(', ') ?? '');
  const [lightTransmission, setLightTransmission] = useState(coating?.light_transmission?.toString() ?? '');
  const [reflectionColor, setReflectionColor] = useState(coating?.residual_reflection_color ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    if (!manufacturerId) { setError('Выберите производителя'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      manufacturer_id: manufacturerId,
      type: type.trim() || null,
      description: description.trim() || null,
      advantages: advantages.split(',').map((s) => s.trim()).filter(Boolean),
      light_transmission: lightTransmission ? Number(lightTransmission) : null,
      residual_reflection_color: reflectionColor.trim() || null,
    };
    const { error: saveError } = coating
      ? await supabase.from('coatings').update(payload).eq('id', coating.id)
      : await supabase.from('coatings').insert(payload);
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <FormCard title={coating ? 'Редактировать покрытие' : 'Новое покрытие'} onClose={onClose}>
      <SelectField label="Производитель" value={manufacturerId} onChange={setManufacturerId} options={manufacturers.map((m) => ({ value: m.id, label: m.name }))} />
      <Field label="Название" value={name} onChange={setName} />
      <Field label="Тип (антиблик / упрочняющее / комбинированное…)" value={type} onChange={setType} />
      <Field label="Описание (для подсказки)" value={description} onChange={setDescription} multiline />
      <Field label="Преимущества (через запятую)" value={advantages} onChange={setAdvantages} />
      <Field label="Светопропускание, %" value={lightTransmission} onChange={setLightTransmission} type="number" />
      <Field label="Цвет остаточного отблеска" value={reflectionColor} onChange={setReflectionColor} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveBar saving={saving} onSave={save} onCancel={onClose} />
    </FormCard>
  );
}

// ============================================================
// Photochromics Tab
// ============================================================
function PhotochromicsTab({
  manufacturers,
  photochromics,
  colors,
  onChanged,
}: {
  manufacturers: Manufacturer[];
  photochromics: Photochromic[];
  colors: Color[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Photochromic | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{photochromics.length} фотохромов</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {(adding || editing) && (
        <PhotochromicForm
          photochromic={editing}
          manufacturers={manufacturers}
          colors={colors}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged(); }}
        />
      )}

      <div className="space-y-2">
        {photochromics.map((p) => {
          const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
          return (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <Sun className="mt-0.5 h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {mfr?.name ?? '—'}
                  {p.darkness_category != null && ` · категория ${p.darkness_category}`}
                  {p.uv_protection && ' · УФ-защита'}
                </p>
                {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
                {p.available_colors.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.available_colors.map((color, i) => (
                      <span key={i} className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{color}</span>
                    ))}
                  </div>
                )}
                {(p.activation_time_sec != null || p.fading_time_sec != null) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {p.activation_time_sec != null && `Активация: ${p.activation_time_sec}с`}
                    {p.activation_time_sec != null && p.fading_time_sec != null && ' · '}
                    {p.fading_time_sec != null && `Просветление: ${p.fading_time_sec}с`}
                  </p>
                )}
              </div>
              <button onClick={() => setEditing(p)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600">
                <Pencil className="h-4 w-4" />
              </button>
              <DeleteButton table="photochromics" id={p.id} onDeleted={onChanged} />
            </div>
          );
        })}
        {photochromics.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Нет фотохромов. Нажмите «Добавить».</p>
        )}
      </div>
    </div>
  );
}

function PhotochromicForm({
  photochromic,
  manufacturers,
  colors,
  onClose,
  onSaved,
}: {
  photochromic: Photochromic | null;
  manufacturers: Manufacturer[];
  colors: Color[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(photochromic?.name ?? '');
  const [manufacturerId, setManufacturerId] = useState(photochromic?.manufacturer_id ?? manufacturers[0]?.id ?? '');
  const [description, setDescription] = useState(photochromic?.description ?? '');
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>(photochromic?.color_ids ?? []);
  const [activationTime, setActivationTime] = useState(photochromic?.activation_time_sec?.toString() ?? '');
  const [fadingTime, setFadingTime] = useState(photochromic?.fading_time_sec?.toString() ?? '');
  const [darknessCategory, setDarknessCategory] = useState(photochromic?.darkness_category?.toString() ?? '');
  const [uvProtection, setUvProtection] = useState(photochromic?.uv_protection ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photochromic) return;
    supabase.from('photochromic_colors').select('color_id').eq('photochromic_id', photochromic.id).then(({ data }) => {
      if (data) setSelectedColorIds(data.map((row) => row.color_id as string));
    });
  }, [photochromic]);

  const save = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    if (!manufacturerId) { setError('Выберите производителя'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      manufacturer_id: manufacturerId,
      description: description.trim() || null,
      available_colors: colors.filter((color) => selectedColorIds.includes(color.id)).map((color) => color.name),
      activation_time_sec: activationTime ? Number(activationTime) : null,
      fading_time_sec: fadingTime ? Number(fadingTime) : null,
      darkness_category: darknessCategory ? Number(darknessCategory) : null,
      uv_protection: uvProtection,
    };
    const { data: savedPhotochromic, error: saveError } = photochromic
      ? { data: { id: photochromic.id }, error: (await supabase.from('photochromics').update(payload).eq('id', photochromic.id)).error }
      : await supabase.from('photochromics').insert(payload).select('id').maybeSingle();
    if (saveError || !savedPhotochromic) { setError(saveError?.message ?? 'Не удалось сохранить фотохром'); setSaving(false); return; }

    const { error: deleteColorsError } = await supabase.from('photochromic_colors').delete().eq('photochromic_id', savedPhotochromic.id);
    if (deleteColorsError) { setError(deleteColorsError.message); setSaving(false); return; }
    if (selectedColorIds.length > 0) {
      const { error: insertColorsError } = await supabase.from('photochromic_colors').insert(
        selectedColorIds.map((colorId) => ({ photochromic_id: savedPhotochromic.id, color_id: colorId }))
      );
      if (insertColorsError) { setError(insertColorsError.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <FormCard title={photochromic ? 'Редактировать фотохром' : 'Новый фотохром'} onClose={onClose}>
      <SelectField label="Производитель" value={manufacturerId} onChange={setManufacturerId} options={manufacturers.map((m) => ({ value: m.id, label: m.name }))} />
      <Field label="Название" value={name} onChange={setName} />
      <Field label="Описание" value={description} onChange={setDescription} multiline />
      <MultiColorField colors={colors} selectedIds={selectedColorIds} onChange={setSelectedColorIds} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Активация, сек" value={activationTime} onChange={setActivationTime} type="number" />
        <Field label="Просветление, сек" value={fadingTime} onChange={setFadingTime} type="number" />
      </div>
      <Field label="Степень затемнения (0-3)" value={darknessCategory} onChange={setDarknessCategory} type="number" />
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={uvProtection} onChange={(e) => setUvProtection(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        <span className="text-sm text-slate-700">УФ-защита</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveBar saving={saving} onSave={save} onCancel={onClose} />
    </FormCard>
  );
}

// ============================================================
// Colors Tab
// ============================================================
function ColorsTab({ colors, onChanged }: { colors: Color[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Color | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{colors.length} цветов</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>
      {(adding || editing) && (
        <ColorForm
          color={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged(); }}
        />
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {colors.map((color) => (
          <div key={color.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span className="h-8 w-8 flex-shrink-0 rounded-full border border-slate-200" style={{ backgroundColor: color.hex ?? '#cbd5e1' }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{color.name}</p>
              {color.hex && <p className="text-xs uppercase text-slate-400">{color.hex}</p>}
            </div>
            <button onClick={() => setEditing(color)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
            <DeleteButton table="colors" id={color.id} onDeleted={onChanged} />
          </div>
        ))}
      </div>
      {colors.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Нет цветов. Нажмите «Добавить».</p>}
    </div>
  );
}

function ColorForm({ color, onClose, onSaved }: { color: Color | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(color?.name ?? '');
  const [hex, setHex] = useState(color?.hex ?? '#64748b');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError('Название обязательно'); return; }
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), hex: hex.trim() || null };
    const { error: saveError } = color
      ? await supabase.from('colors').update(payload).eq('id', color.id)
      : await supabase.from('colors').insert(payload);
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <FormCard title={color ? 'Редактировать цвет' : 'Новый цвет'} onClose={onClose}>
      <Field label="Название" value={name} onChange={setName} />
      <label className="flex items-center gap-3">
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1" />
        <Field label="HEX-код" value={hex} onChange={setHex} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveBar saving={saving} onSave={save} onCancel={onClose} />
    </FormCard>
  );
}

function MultiColorField({ colors, selectedIds, onChange }: { colors: Color[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">Доступные цвета</span>
      {colors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">Сначала добавьте цвета в справочник</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-white p-3 sm:grid-cols-3">
          {colors.map((color) => (
            <label key={color.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selectedIds.includes(color.id)} onChange={() => toggle(color.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: color.hex ?? '#cbd5e1' }} />
              <span className="truncate">{color.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared UI components
// ============================================================
function DeleteButton({ table, id, onDeleted }: { table: string; id: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirming(false)}>
          <div className="rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm text-slate-700">Удалить запись?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                Отмена
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  await supabase.from(table).delete().eq('id', id);
                  setDeleting(false);
                  setConfirming(false);
                  onDeleted();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FormCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-slate-900">{title}</p>
        <button onClick={onClose} className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function SaveBar({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
        Отмена
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Сохранить
      </button>
    </div>
  );
}
