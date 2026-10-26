import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase, type Lens, isSaleActive, computeSalePrice, displayPrice, priceDifference } from '@/lib/supabase';
import { powerRangeMatchesFilter, type LensPowerRange } from '@/lib/lens-power-ranges';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Glasses,
  ChevronDown,
  Check,
  X,
  Sun,
  Layers,
  Tag,
  Ruler,
  Info,
  Upload,
  TrendingDown,
  CalendarClock,
  LogIn,
  LogOut,
  Shield,
  Pencil,
  Percent,
  CheckSquare,
  Square,
  Truck,
  EyeOff,
  Loader2,
  Building2,
  Focus,
  Gem,
  Sparkles,
  CircleDot,
  Aperture,
  Orbit,
  Disc,
  DollarSign,
  PackageCheck,
  Columns3,
  PencilLine,
  MoveHorizontal,
  Plus,
  Copy,
  Trash2,
  AlertCircle,
  Palette,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { ViewModeSelector, type ViewMode } from '@/components/ViewModeSelector';
import { Pagination } from '@/components/Pagination';

type ColumnKey =
  | 'brand' | 'name' | 'lens_type' | 'index' | 'design' | 'material'
  | 'price' | 'delivery' | 'status' | 'coating' | 'sph_range' | 'cyl_range'
  | 'diameter' | 'photochromic' | 'progressive' | 'notes'
  | 'purchase_price' | 'price_diff' | 'sale' | 'ekka' | 'myopia_control';

const ALL_COLUMNS: { key: ColumnKey; label: string; adminOnly?: boolean }[] = [
  { key: 'brand', label: 'Бренд' },
  { key: 'name', label: 'Название' },
  { key: 'lens_type', label: 'Тип' },
  { key: 'index', label: 'Индекс' },
  { key: 'design', label: 'Дизайн' },
  { key: 'material', label: 'Материал' },
  { key: 'price', label: 'Цена' },
  { key: 'sale', label: 'Акция' },
  { key: 'delivery', label: 'Поставка' },
  { key: 'status', label: 'Статус' },
  { key: 'coating', label: 'Покрытия' },
  { key: 'sph_range', label: 'Сфера' },
  { key: 'cyl_range', label: 'Цилиндр' },
  { key: 'diameter', label: 'Диаметр' },
  { key: 'photochromic', label: 'Фотохром' },
  { key: 'progressive', label: 'Прогрессив' },
  { key: 'notes', label: 'Примечания' },
  { key: 'purchase_price', label: 'Учётная цена', adminOnly: true },
  { key: 'price_diff', label: 'Разница', adminOnly: true },
  { key: 'ekka', label: 'ЭККА' },
  { key: 'myopia_control', label: 'Контр. миопии' },
];

const DEFAULT_COLUMNS: ColumnKey[] = ['brand', 'name', 'lens_type', 'index', 'price', 'delivery', 'status'];

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  brand: 100, name: 200, lens_type: 90, index: 70, design: 90, material: 90,
  price: 90, sale: 70, delivery: 90, status: 90, coating: 120,
  sph_range: 90, cyl_range: 90, diameter: 90, photochromic: 80,
  progressive: 80, notes: 150, purchase_price: 90, price_diff: 80,
  ekka: 100, myopia_control: 90,
};

function loadColumnWidths(): Record<ColumnKey, number> {
  try {
    const stored = localStorage.getItem('lens-column-widths');
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, number>;
      const result = { ...DEFAULT_COLUMN_WIDTHS };
      (Object.keys(parsed) as ColumnKey[]).forEach((k) => {
        if (k in DEFAULT_COLUMN_WIDTHS && typeof parsed[k] === 'number') result[k] = parsed[k];
      });
      return result;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_COLUMN_WIDTHS };
}

function saveColumnWidths(widths: Record<ColumnKey, number>) {
  try {
    localStorage.setItem('lens-column-widths', JSON.stringify(widths));
  } catch { /* ignore */ }
}

function loadVisibleColumns(isAdmin: boolean): ColumnKey[] {
  try {
    const stored = localStorage.getItem('lens-visible-columns');
    if (stored) {
      const parsed = JSON.parse(stored) as unknown[];
      return parsed.filter((k): k is ColumnKey =>
        typeof k === 'string' && ALL_COLUMNS.some((c) => c.key === k && (!c.adminOnly || isAdmin))
      );
    }
  } catch { /* ignore */ }
  const defaults: ColumnKey[] = isAdmin
    ? [...DEFAULT_COLUMNS, 'purchase_price', 'price_diff']
    : DEFAULT_COLUMNS;
  return defaults;
}

function saveVisibleColumns(cols: ColumnKey[]) {
  try {
    localStorage.setItem('lens-visible-columns', JSON.stringify(cols));
  } catch { /* ignore */ }
}

type Filters = {
  search: string;
  brands: string[];
  lensTypes: string[];
  indices: string[];
  designs: string[];
  coatings: string[];
  photochromic: boolean | null;
  progressive: boolean | null;
  diameters: number[];
  maxPrice: number | null;
  minSph: number | null;
  minCyl: number | null;
  onSale: boolean | null;
  availability: 'all' | 'available' | 'unavailable';
  maxDeliveryDays: number | null;
  sphSign: 'any' | 'positive' | 'negative';
  cylSign: 'any' | 'positive' | 'negative';
};

const emptyFilters: Filters = {
  search: '',
  brands: [],
  lensTypes: [],
  indices: [],
  designs: [],
  coatings: [],
  photochromic: null,
  progressive: null,
  diameters: [],
  maxPrice: null,
  minSph: null,
  minCyl: null,
  onSale: null,
  availability: 'all',
  maxDeliveryDays: null,
  sphSign: 'any',
  cylSign: 'any',
};

const ExcelImportModal = lazy(() =>
  import('@/components/ExcelImportModal').then((m) => ({ default: m.ExcelImportModal }))
);
const SaleModal = lazy(() =>
  import('@/components/SaleModal').then((m) => ({ default: m.SaleModal }))
);
const AuthModal = lazy(() =>
  import('@/components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const EditLensModal = lazy(() =>
  import('@/components/EditLensModal').then((m) => ({ default: m.EditLensModal }))
);
const BulkEditModal = lazy(() =>
  import('@/components/BulkEditModal').then((m) => ({ default: m.BulkEditModal }))
);
const BulkSaleModal = lazy(() =>
  import('@/components/BulkSaleModal').then((m) => ({ default: m.BulkSaleModal }))
);
const PriceCoefficientModal = lazy(() =>
  import('@/components/PriceCoefficientModal').then((m) => ({ default: m.PriceCoefficientModal }))
);
const ReferenceManager = lazy(() =>
  import('@/components/ReferenceManager').then((m) => ({ default: m.ReferenceManager }))
);

export default function App() {
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [sortField, setSortField] = useState<'price' | 'brand' | 'name' | 'index'>('brand');
  const [sortAsc, setSortAsc] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saleLens, setSaleLens] = useState<Lens | null>(null);
  const [editLens, setEditLens] = useState<Lens | null>(null);
  const [editMode2, setEditMode2] = useState<'edit' | 'create' | 'copy'>('edit');
  const [deleteLens, setDeleteLens] = useState<Lens | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkSale, setShowBulkSale] = useState(false);
  const [showPriceCoeff, setShowPriceCoeff] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-3');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [togglingAvail, setTogglingAvail] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => loadVisibleColumns(false));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => loadColumnWidths());
  const [editMode, setEditMode] = useState(false);
  const [showReferenceManager, setShowReferenceManager] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const checkAdmin = async (u: User | null) => {
    if (!u) {
      setIsAdmin(false);
      return;
    }
    const metaAdmin = u.app_metadata?.is_admin === true;
    if (metaAdmin) {
      setIsAdmin(true);
      return;
    }
    // JWT may be stale — try refreshing to pick up is_admin flag
    await supabase.auth.refreshSession();
    const { data: refreshed } = await supabase.auth.getSession();
    const ru = refreshed.session?.user ?? null;
    if (ru?.app_metadata?.is_admin === true) {
      setUser(ru);
      setIsAdmin(true);
      return;
    }
    // Last resort: call is_admin() RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('is_admin');
    if (rpcError) {
      setIsAdmin(metaAdmin);
    } else {
      setIsAdmin(!!rpcData || metaAdmin);
    }
  };

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user ?? null;
        setUser(u);
        if (u) {
          await supabase.auth.refreshSession();
          const { data: refreshed } = await supabase.auth.getSession();
          const refreshedUser = refreshed.session?.user ?? null;
          setUser(refreshedUser);
          await checkAdmin(refreshedUser);
        } else {
          setIsAdmin(false);
        }
      } catch (authError) {
        if (active) {
          setError(authError instanceof Error ? authError.message : 'Не удалось проверить авторизацию');
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void initializeAuth();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setIsAdmin(u?.app_metadata?.is_admin === true);
      window.setTimeout(() => {
        void checkAdmin(u);
      }, 0);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setVisibleColumns(loadVisibleColumns(isAdmin));
  }, [isAdmin]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      saveVisibleColumns(next);
      return next;
    });
  };

  const handleColumnResize = (key: ColumnKey, newWidth: number) => {
    const clamped = Math.max(50, Math.min(500, Math.round(newWidth)));
    setColumnWidths((prev) => {
      const next = { ...prev, [key]: clamped };
      saveColumnWidths(next);
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setBulkMode(false);
    setEditMode(false);
    setSelectedIds(new Set());
  };

  const fetchLenses = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: rangeData, error: rangeError }] = await Promise.all([
        supabase.from('lenses').select('*'),
        supabase.from('lens_power_ranges').select('*'),
      ]);
      if (error || rangeError) {
        setError(error?.message ?? rangeError?.message ?? 'Не удалось загрузить каталог');
      } else if (data) {
        const rangesByLens = new Map<string, LensPowerRange[]>();
        (rangeData ?? []).forEach((range) => {
          const typedRange = range as LensPowerRange;
          const current = rangesByLens.get(typedRange.lens_id) ?? [];
          current.push(typedRange);
          rangesByLens.set(typedRange.lens_id, current);
        });
        setLenses((data as Lens[]).map((lens) => ({ ...lens, power_ranges: rangesByLens.get(lens.id) ?? [] })));
      }
    } catch (networkError) {
      setError(networkError instanceof Error ? networkError.message : 'Нет соединения с базой. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLenses();
  }, [fetchLenses]);

  const uniqueBrands = useMemo(
    () => [...new Set(lenses.map((l) => l.brand))].sort(),
    [lenses]
  );
  const uniqueLensTypes = useMemo(
    () => [...new Set(lenses.map((l) => l.lens_type))].sort(),
    [lenses]
  );
  const uniqueIndices = useMemo(
    () =>
      [...new Set(lenses.map((l) => l.index).filter(Boolean))].sort(
        (a, b) => (a as number) - (b as number)
      ),
    [lenses]
  );
  const uniqueDesigns = useMemo(
    () => [...new Set(lenses.map((l) => l.design).filter(Boolean))].sort() as string[],
    [lenses]
  );
  const uniqueCoatings = useMemo(
    () => [...new Set(lenses.flatMap((l) => l.coating))].sort(),
    [lenses]
  );
  const uniqueDiameters = useMemo(
    () => [...new Set(lenses.flatMap((l) => l.diameter))].sort((a, b) => a - b),
    [lenses]
  );
  const maxPriceInData = useMemo(
    () => Math.max(...lenses.map((l) => l.price), 50000),
    [lenses]
  );
  const maxDeliveryDaysInData = useMemo(
    () => Math.max(...lenses.map((l) => l.delivery_days ?? 0), 30),
    [lenses]
  );

  const toggleArrayFilter = <K extends keyof Filters>(
    key: K,
    value: string | number
  ) => {
    setFilters((prev) => {
      const arr = prev[key] as (string | number)[];
      const newArr = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: newArr };
    });
  };

  const resetFilters = () => setFilters(emptyFilters);

  const filtered = useMemo(() => {
    return lenses
      .filter((l) => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const haystack = `${l.brand} ${l.name} ${l.notes ?? ''} ${l.design ?? ''}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filters.brands.length > 0 && !filters.brands.includes(l.brand)) return false;
        if (filters.lensTypes.length > 0 && !filters.lensTypes.includes(l.lens_type)) return false;
        if (filters.indices.length > 0 && l.index && !filters.indices.includes(String(l.index)))
          return false;
        if (filters.designs.length > 0 && l.design && !filters.designs.includes(l.design))
          return false;
        if (filters.coatings.length > 0) {
          const hasAll = filters.coatings.every((c) => l.coating.includes(c));
          if (!hasAll) return false;
        }
        if (filters.photochromic !== null && l.photochromic !== filters.photochromic) return false;
        if (filters.progressive !== null && l.progressive !== filters.progressive) return false;
        if (filters.diameters.length > 0) {
          const hasAny = filters.diameters.some((d) => l.diameter.includes(d));
          if (!hasAny) return false;
        }
        if (filters.maxPrice !== null && l.price > filters.maxPrice) return false;
        if (l.power_ranges && l.power_ranges.length > 0) {
          if (!powerRangeMatchesFilter(l.power_ranges, filters.minSph, filters.minCyl, filters.sphSign, filters.cylSign)) return false;
        } else {
          if (filters.minSph !== null) {
            if (l.sph_max === null || Math.abs(l.sph_max) < Math.abs(filters.minSph)) return false;
          }
          if (filters.sphSign !== 'any' && l.sph_range) {
            const hasPlus = l.sph_range.includes('+');
            const hasMinus = l.sph_range.includes('-') || l.sph_range.includes('−');
            if (filters.sphSign === 'positive' && !hasPlus) return false;
            if (filters.sphSign === 'negative' && !hasMinus) return false;
          }
          if (filters.minCyl !== null) {
            if (l.cyl_max === null || Math.abs(l.cyl_max) < Math.abs(filters.minCyl)) return false;
          }
          if (filters.cylSign !== 'any' && l.cyl_range) {
            const hasPlus = l.cyl_range.includes('+');
            const hasMinus = l.cyl_range.includes('-') || l.cyl_range.includes('−');
            if (filters.cylSign === 'positive' && !hasPlus) return false;
            if (filters.cylSign === 'negative' && !hasMinus) return false;
          }
        }
        if (filters.onSale !== null) {
          const isSaleActive = l.on_sale && (!l.sale_ends_at || new Date(l.sale_ends_at) > new Date());
          if (isSaleActive !== filters.onSale) return false;
        }
        if (filters.availability === 'available' && !l.is_available) return false;
        if (filters.availability === 'unavailable' && l.is_available) return false;
        if (filters.maxDeliveryDays !== null) {
          if (l.delivery_days === null || l.delivery_days > filters.maxDeliveryDays) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'price') cmp = a.price - b.price;
        else if (sortField === 'index') cmp = (a.index ?? 0) - (b.index ?? 0);
        else cmp = String(a[sortField]).localeCompare(String(b[sortField]), 'ru');
        return sortAsc ? cmp : -cmp;
      });
  }, [lenses, filters, sortField, sortAsc]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    count += filters.brands.length + filters.lensTypes.length + filters.indices.length;
    count += filters.designs.length + filters.coatings.length + filters.diameters.length;
    if (filters.photochromic !== null) count++;
    if (filters.progressive !== null) count++;
    if (filters.maxPrice !== null && filters.maxPrice < maxPriceInData) count++;
    if (filters.minSph !== null) count++;
    if (filters.minCyl !== null) count++;
    if (filters.onSale !== null) count++;
    if (filters.availability !== 'all') count++;
    if (filters.maxDeliveryDays !== null) count++;
    if (filters.sphSign !== 'any') count++;
    if (filters.cylSign !== 'any') count++;
    return count;
  }, [filters, maxPriceInData]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(price);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((l) => l.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedLenses = useMemo(
    () => lenses.filter((l) => selectedIds.has(l.id)),
    [lenses, selectedIds]
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const handleDeleteLens = async (lens: Lens) => {
    const { error: delError } = await supabase.from('lenses').delete().eq('id', lens.id);
    if (delError) {
      setError(`Не удалось удалить: ${delError.message}`);
    } else {
      setLenses((prev) => prev.filter((l) => l.id !== lens.id));
      setSelectedLens(null);
      setDeleteLens(null);
    }
  };

  const openCreateLens = () => {
    setEditLens(null);
    setEditMode2('create');
  };

  const openCopyLens = (lens: Lens) => {
    setEditLens(lens);
    setEditMode2('copy');
    setSelectedLens(null);
  };

  const openEditLens = (lens: Lens) => {
    setEditLens(lens);
    setEditMode2('edit');
    setSelectedLens(null);
  };

  const handleInlineEdit = async (id: string, field: string, value: string | number | boolean | null) => {
    const { data, error: updateError } = await supabase
      .from('lenses')
      .update({ [field]: value })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (!updateError && data) {
      setLenses((prev) => prev.map((l) => (l.id === id ? { ...data as Lens, power_ranges: l.power_ranges } : l)));
    }
    setEditingCell(null);
  };

  const toggleAvailability = async (lens: Lens) => {
    setTogglingAvail(lens.id);
    const { data, error: updateError } = await supabase
      .from('lenses')
      .update({ is_available: !lens.is_available })
      .eq('id', lens.id)
      .select()
      .maybeSingle();
    if (updateError) {
      setError(`Не удалось изменить статус: ${updateError.message}`);
    } else if (data) {
      setLenses((prev) => prev.map((l) => (l.id === lens.id ? { ...data as Lens, power_ranges: l.power_ranges } : l)));
      if (selectedLens?.id === lens.id) setSelectedLens({ ...data as Lens, power_ranges: lens.power_ranges });
    }
    setTogglingAvail(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Glasses className="h-6 w-6 animate-pulse" />
          <span className="text-sm font-medium">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/20">
                <Glasses className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Прайс линз
                </h1>
                <p className="text-xs text-slate-500">
                  {lenses.length} позиций в каталоге
                  {user && (
                    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
                      <span className="font-medium text-slate-600">{user.email}</span>
                      {isAdmin ? (
                        <><Shield className="h-3 w-3 text-emerald-600" /> <span className="font-medium text-emerald-700">Админ</span></>
                      ) : (
                        <span className="font-medium text-slate-500">Гость</span>
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Поиск по названию..."
                  className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Admin buttons */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setBulkMode(!bulkMode)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      bulkMode
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">{bulkMode ? 'Выйти из выбора' : 'Массовый выбор'}</span>
                  </button>
                  <button
                    onClick={() => setShowPriceCoeff(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Percent className="h-4 w-4" />
                    <span className="hidden sm:inline">Цены</span>
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                  <button
                    onClick={() => setShowReferenceManager(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Справочники</span>
                  </button>
                  <button
                    onClick={openCreateLens}
                    className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Создать</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Фильтры</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Auth */}
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Войти</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Mobile search */}
        <div className="relative mb-4 sm:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Поиск по названию..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Bulk selection toolbar */}
        {bulkMode && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-700">
                Выбрано: {selectedIds.size}
              </span>
              <button onClick={selectAllFiltered} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Выбрать все ({filtered.length})
              </button>
              {selectedIds.size > 0 && (
                <button onClick={clearSelection} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                  Очистить
                </button>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkSale(true)}
                  className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline">Назначить акцию</span>
                </button>
                <button
                  onClick={() => setShowBulkEdit(true)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Изменить выбранные</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Filters sidebar */}
          {showFilters && (
            <aside className="lg:w-72 lg:flex-shrink-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                    Параметры
                  </h2>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Сбросить
                    </button>
                  )}
                </div>

                <div className="space-y-5">
                  <FilterSection title="Производитель" icon={<Building2 className="h-4 w-4" />}>
                    {uniqueBrands.map((brand) => (
                      <CheckboxItem
                        key={brand}
                        label={brand}
                        checked={filters.brands.includes(brand)}
                        onChange={() => toggleArrayFilter('brands', brand)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Тип линзы" icon={<Focus className="h-4 w-4" />}>
                    {uniqueLensTypes.map((type) => (
                      <CheckboxItem
                        key={type}
                        label={type}
                        checked={filters.lensTypes.includes(type)}
                        onChange={() => toggleArrayFilter('lensTypes', type)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Индекс преломления" icon={<Gem className="h-4 w-4" />}>
                    {uniqueIndices.map((idx) => (
                      <CheckboxItem
                        key={String(idx)}
                        label={`1.${String(idx).split('.')[1] ?? idx}`}
                        checked={filters.indices.includes(String(idx))}
                        onChange={() => toggleArrayFilter('indices', String(idx))}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Дизайн" icon={<Orbit className="h-4 w-4" />}>
                    {uniqueDesigns.map((design) => (
                      <CheckboxItem
                        key={design}
                        label={design}
                        checked={filters.designs.includes(design)}
                        onChange={() => toggleArrayFilter('designs', design)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Покрытия" icon={<Sparkles className="h-4 w-4" />}>
                    {uniqueCoatings.map((coating) => (
                      <CheckboxItem
                        key={coating}
                        label={coating}
                        checked={filters.coatings.includes(coating)}
                        onChange={() => toggleArrayFilter('coatings', coating)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Фотохром" icon={<Sun className="h-4 w-4" />}>
                    <TriStateToggle
                      value={filters.photochromic}
                      onChange={(v) => setFilters({ ...filters, photochromic: v })}
                      trueLabel="Да"
                      falseLabel="Нет"
                    />
                  </FilterSection>

                  <FilterSection title="Прогрессивная" icon={<Aperture className="h-4 w-4" />}>
                    <TriStateToggle
                      value={filters.progressive}
                      onChange={(v) => setFilters({ ...filters, progressive: v })}
                      trueLabel="Да"
                      falseLabel="Нет"
                    />
                  </FilterSection>

                  {/* SPH filter with sign selector */}
                  <FilterSection title="Сфера (SPH)" icon={<CircleDot className="h-4 w-4" />}>
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        {([
                          { label: 'Любая', val: 'any' },
                          { label: '+', val: 'positive' },
                          { label: '−', val: 'negative' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => setFilters({ ...filters, sphSign: opt.val })}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                              filters.sphSign === opt.val
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="20"
                        value={filters.minSph ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFilters({ ...filters, minSph: v === '' ? null : Number(v) });
                        }}
                        placeholder="Значение (например 4.00)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      {filters.minSph !== null && (
                        <p className="text-xs text-slate-500">
                          Линзы с диапазоном сферы
                          {filters.sphSign === 'positive' ? ' от +' : filters.sphSign === 'negative' ? ' от −' : ' от ±'}
                          {filters.minSph.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">
                        Показывает линзы, подходящие для рецепта с указанной сферой
                      </p>
                    </div>
                  </FilterSection>

                  {/* CYL filter with sign selector */}
                  <FilterSection title="Цилиндр (CYL)" icon={<Disc className="h-4 w-4" />}>
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        {([
                          { label: 'Любой', val: 'any' },
                          { label: '+', val: 'positive' },
                          { label: '−', val: 'negative' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => setFilters({ ...filters, cylSign: opt.val })}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                              filters.cylSign === opt.val
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="10"
                        value={filters.minCyl ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFilters({ ...filters, minCyl: v === '' ? null : Number(v) });
                        }}
                        placeholder="Значение (например 2.00)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      {filters.minCyl !== null && (
                        <p className="text-xs text-slate-500">
                          Линзы с диапазоном цилиндра
                          {filters.cylSign === 'positive' ? ' от +' : filters.cylSign === 'negative' ? ' от −' : ' от ±'}
                          {filters.minCyl.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">
                        Показывает линзы, подходящие для рецепта с указанным цилиндром
                      </p>
                    </div>
                  </FilterSection>

                  <FilterSection title="Диаметр (мм)" icon={<Ruler className="h-4 w-4" />}>
                    <div className="flex flex-wrap gap-2">
                      {uniqueDiameters.map((d) => (
                        <button
                          key={d}
                          onClick={() => toggleArrayFilter('diameters', d)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            filters.diameters.includes(d)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Акция" icon={<TrendingDown className="h-4 w-4" />}>
                    <TriStateToggle
                      value={filters.onSale}
                      onChange={(v) => setFilters({ ...filters, onSale: v })}
                      trueLabel="Только акции"
                      falseLabel="Без акций"
                    />
                  </FilterSection>

                  <FilterSection title="Доступность" icon={<EyeOff className="h-4 w-4" />}>
                    <div className="flex gap-1.5">
                      {([
                        { label: 'Все', val: 'all' },
                        { label: 'В продаже', val: 'available' },
                        { label: 'Снято', val: 'unavailable' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => setFilters({ ...filters, availability: opt.val })}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                            filters.availability === opt.val
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </FilterSection>

                  <FilterSection title="Срок поставки" icon={<Truck className="h-4 w-4" />}>
                    <input
                      type="range"
                      min={1}
                      max={maxDeliveryDaysInData}
                      step={1}
                      value={filters.maxDeliveryDays ?? maxDeliveryDaysInData}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          maxDeliveryDays: Number(e.target.value) < maxDeliveryDaysInData
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {filters.maxDeliveryDays !== null
                        ? `до ${filters.maxDeliveryDays} дн.`
                        : 'без ограничения'}
                    </div>
                  </FilterSection>

                  <FilterSection title="Цена до" icon={<DollarSign className="h-4 w-4" />}>
                    <input
                      type="range"
                      min={1000}
                      max={maxPriceInData}
                      step={500}
                      value={filters.maxPrice ?? maxPriceInData}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          maxPrice: Number(e.target.value) < maxPriceInData
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {filters.maxPrice !== null
                        ? `до ${formatPrice(filters.maxPrice)}`
                        : 'без ограничения'}
                    </div>
                  </FilterSection>
                </div>
              </div>
            </aside>
          )}

          {/* Results */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {loading ? (
                  'Загрузка...'
                ) : (
                  <>
                    Найдено: <span className="font-semibold text-slate-900">{filtered.length}</span> из{' '}
                    {lenses.length}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                {viewMode === 'list' && isAdmin && (
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      editMode ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title={editMode ? 'Выйти из режима редактирования' : 'Включить редактирование таблицы'}
                  >
                    <PencilLine className="h-4 w-4" />
                    <span className="hidden sm:inline">{editMode ? 'Редакт. вкл' : 'Редактирование'}</span>
                  </button>
                )}
                {viewMode === 'list' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowColumnPicker(!showColumnPicker)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        showColumnPicker ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Columns3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Столбцы</span>
                    </button>
                    {showColumnPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
                        <div className="absolute right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg w-48">
                          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Видимые столбцы</p>
                          {ALL_COLUMNS.filter((c) => !c.adminOnly || isAdmin).map((col) => (
                            <label
                              key={col.key}
                              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                            >
                              <span
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                                  visibleColumns.includes(col.key) ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {visibleColumns.includes(col.key) && <Check className="h-3 w-3 text-white" />}
                              </span>
                              <input
                                type="checkbox"
                                checked={visibleColumns.includes(col.key)}
                                onChange={() => toggleColumn(col.key)}
                                className="sr-only"
                              />
                              {col.label}
                            </label>
                          ))}
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            onClick={() => {
                              const defaults: ColumnKey[] = isAdmin
                                ? [...DEFAULT_COLUMNS, 'purchase_price', 'price_diff']
                                : DEFAULT_COLUMNS;
                              setVisibleColumns(defaults);
                              saveVisibleColumns(defaults);
                              setShowColumnPicker(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Сбросить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <ViewModeSelector viewMode={viewMode} onChange={setViewMode} />
                <SortDropdown
                  sortField={sortField}
                  sortAsc={sortAsc}
                  onFieldChange={setSortField}
                  onToggleDir={() => setSortAsc(!sortAsc)}
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                <span>Не удалось загрузить данные: {error}</span>
                <button
                  onClick={() => { setError(null); fetchLenses(); }}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Повторить
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16">
                <Glasses className="mb-3 h-12 w-12 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Линзы не найдены</p>
                <p className="mt-1 text-xs text-slate-400">
                  Попробуйте изменить параметры фильтра
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}

            <div ref={resultsRef}>
              {viewMode === 'list' ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <LensListHeader
                    isAdmin={isAdmin}
                    bulkMode={bulkMode}
                    visibleColumns={visibleColumns}
                    columnWidths={columnWidths}
                    onColumnResize={handleColumnResize}
                    allSelectedOnPage={paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id))}
                    onToggleAll={() => {
                      const allOnPageSelected = paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));
                      if (allOnPageSelected) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          paginated.forEach((l) => next.delete(l.id));
                          return next;
                        });
                      } else {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          paginated.forEach((l) => next.add(l.id));
                          return next;
                        });
                      }
                    }}
                  />
                  {paginated.map((lens) => (
                    <LensListRow
                      key={lens.id}
                      lens={lens}
                      onClick={() => setSelectedLens(lens)}
                      formatPrice={formatPrice}
                      bulkMode={bulkMode}
                      isSelected={selectedIds.has(lens.id)}
                      onToggleSelect={() => toggleSelect(lens.id)}
                      isAdmin={isAdmin}
                      editMode={editMode}
                      visibleColumns={visibleColumns}
                      columnWidths={columnWidths}
                      editingCell={editingCell}
                      onEditCell={(field) => setEditingCell({ id: lens.id, field })}
                      onInlineEdit={handleInlineEdit}
                      onToggleAvailability={() => toggleAvailability(lens)}
                      togglingAvail={togglingAvail === lens.id}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid-4'
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : viewMode === 'grid-2'
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
                      : 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                  }
                >
                  {paginated.map((lens) => (
                    <LensCard
                      key={lens.id}
                      lens={lens}
                      onClick={() => setSelectedLens(lens)}
                      formatPrice={formatPrice}
                      bulkMode={bulkMode}
                      isSelected={selectedIds.has(lens.id)}
                      onToggleSelect={() => toggleSelect(lens.id)}
                      isAdmin={isAdmin}
                      onToggleAvailability={() => toggleAvailability(lens)}
                      togglingAvail={togglingAvail === lens.id}
                    />
                  ))}
                </div>
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Detail modal */}
      {selectedLens && (
        <LensDetailModal
          lens={selectedLens}
          onClose={() => setSelectedLens(null)}
          formatPrice={formatPrice}
          onManageSale={(lens) => setSaleLens(lens)}
          isAdmin={isAdmin}
          onEdit={(lens) => openEditLens(lens)}
          onCopy={(lens) => openCopyLens(lens)}
          onDelete={(lens) => setDeleteLens(lens)}
          onToggleAvailability={() => toggleAvailability(selectedLens)}
          togglingAvail={togglingAvail === selectedLens.id}
        />
      )}

      {/* Sale modal */}
      {saleLens && (
        <Suspense fallback={null}>
          <SaleModal
            lens={saleLens}
            onClose={() => setSaleLens(null)}
            onUpdated={(updated) => {
              setLenses((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
              setSelectedLens(updated);
              setSaleLens(null);
            }}
          />
        </Suspense>
      )}

      {/* Edit/Create/Copy lens modal */}
      {(editLens != null || editMode2 === 'create') && (
        <Suspense fallback={null}>
          <EditLensModal
            lens={editLens}
            mode={editMode2}
            onClose={() => { setEditLens(null); setEditMode2('edit'); }}
            onUpdated={(updated) => {
              if (editMode2 === 'edit' && editLens) {
                fetchLenses();
              } else {
                setLenses((prev) => [updated, ...prev]);
              }
              setEditLens(null);
              setEditMode2('edit');
            }}
          />
        </Suspense>
      )}

      {/* Delete lens confirmation */}
      {deleteLens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteLens(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Удалить линзу?</h3>
                <p className="text-sm text-slate-500">Это действие нельзя отменить.</p>
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-900">{deleteLens.brand} — {deleteLens.name}</p>
              <p className="text-xs text-slate-500">{deleteLens.lens_type}{deleteLens.index ? `, индекс ${deleteLens.index}` : ''}</p>
            </div>
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleteLens(null); setError(null); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeleteLens(deleteLens)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit modal */}
      {showBulkEdit && (
        <Suspense fallback={null}>
          <BulkEditModal
            lenses={selectedLenses}
            onClose={() => setShowBulkEdit(false)}
            onUpdated={() => {
              fetchLenses();
              setShowBulkEdit(false);
              clearSelection();
            }}
          />
        </Suspense>
      )}

      {/* Bulk sale modal */}
      {showBulkSale && (
        <Suspense fallback={null}>
          <BulkSaleModal
            lenses={selectedLenses}
            onClose={() => setShowBulkSale(false)}
            onUpdated={() => {
              fetchLenses();
              setShowBulkSale(false);
              clearSelection();
            }}
          />
        </Suspense>
      )}

      {/* Price coefficient modal */}
      {showPriceCoeff && (
        <Suspense fallback={null}>
          <PriceCoefficientModal
            brandFilter={filters.brands}
            availableBrands={uniqueBrands}
            onClose={() => setShowPriceCoeff(false)}
            onUpdated={() => {
              fetchLenses();
              setShowPriceCoeff(false);
            }}
          />
        </Suspense>
      )}

      {/* Excel import modal */}
      {showImportModal && (
        <Suspense fallback={null}>
          <ExcelImportModal
            onClose={() => setShowImportModal(false)}
            onImported={() => {
              fetchLenses();
              setShowImportModal(false);
            }}
          />
        </Suspense>
      )}

      {/* Auth modal */}
      {showAuth && (
        <Suspense fallback={null}>
          <AuthModal onClose={() => setShowAuth(false)} />
        </Suspense>
      )}

      {/* Reference manager modal */}
      {showReferenceManager && (
        <Suspense fallback={null}>
          <ReferenceManager onClose={() => setShowReferenceManager(false)} />
        </Suspense>
      )}
    </div>
  );
}

function FilterSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="mb-2 flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function CheckboxItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-slate-600 transition hover:bg-slate-50">
      <span
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
          checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

function TriStateToggle({
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  trueLabel: string;
  falseLabel: string;
}) {
  const options: { label: string; val: boolean | null }[] = [
    { label: 'Любой', val: null },
    { label: trueLabel, val: true },
    { label: falseLabel, val: false },
  ];
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.val)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
            value === opt.val
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SortDropdown({
  sortField,
  sortAsc,
  onFieldChange,
  onToggleDir,
}: {
  sortField: 'price' | 'brand' | 'name' | 'index';
  sortAsc: boolean;
  onFieldChange: (f: 'price' | 'brand' | 'name' | 'index') => void;
  onToggleDir: () => void;
}) {
  const [open, setOpen] = useState(false);
  const labels: Record<string, string> = {
    brand: 'По производителю',
    name: 'По названию',
    price: 'По цене',
    index: 'По индексу',
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {labels[sortField]}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {(Object.keys(labels) as ('price' | 'brand' | 'name' | 'index')[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  onFieldChange(key);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition hover:bg-slate-50 ${
                  sortField === key ? 'font-semibold text-blue-600' : 'text-slate-600'
                }`}
              >
                {labels[key]}
                {sortField === key && <Check className="h-4 w-4" />}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button
              onClick={() => {
                onToggleDir();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              {sortAsc ? 'По возрастанию' : 'По убыванию'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LensCard({
  lens,
  onClick,
  formatPrice,
  bulkMode,
  isSelected,
  onToggleSelect,
  isAdmin,
  onToggleAvailability,
  togglingAvail,
}: {
  lens: Lens;
  onClick: () => void;
  formatPrice: (p: number) => string;
  bulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isAdmin: boolean;
  onToggleAvailability: () => void;
  togglingAvail: boolean;
}) {
  const saleActive = isSaleActive(lens);
  const salePriceVal = computeSalePrice(lens);
  const dispPrice = displayPrice(lens);
  const discount = saleActive && salePriceVal != null && salePriceVal < lens.price
    ? Math.round((1 - salePriceVal / lens.price) * 100)
    : 0;
  const priceDiff = priceDifference(lens);
  const coatingText = lens.coating.length > 0
    ? lens.coating.join(', ')
    : '';

  return (
    <div
      onClick={bulkMode ? onToggleSelect : onClick}
      className={`group flex cursor-pointer flex-col rounded-xl border p-3.5 text-left shadow-sm transition-all hover:shadow-md ${
        !lens.is_available
          ? 'border-slate-200 bg-slate-50/50 opacity-70'
          : bulkMode && isSelected
          ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200'
          : bulkMode
          ? 'border-slate-200 bg-white hover:border-indigo-300'
          : saleActive
          ? 'border-rose-300 bg-gradient-to-br from-rose-50/40 to-white hover:border-rose-400'
          : 'border-slate-200 bg-white hover:border-blue-300'
      }`}
    >
      {/* Top row: brand + badges */}
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-start gap-1.5">
          {bulkMode && (
            <span className={`mt-0.5 flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
              {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </span>
          )}
          <div className="min-w-0">
            <span className="inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              {lens.brand}
            </span>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-slate-900 group-hover:text-blue-700 line-clamp-2">
              {lens.name}
            </h3>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          {!lens.is_available && (
            <span className="inline-flex items-center gap-0.5 rounded bg-slate-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
              <EyeOff className="h-2.5 w-2.5" />
              Снято
            </span>
          )}
          {saleActive && (
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              <TrendingDown className="h-2.5 w-2.5" />
              {discount > 0 ? `-${discount}%` : 'АКЦИЯ'}
            </span>
          )}
          <div className="flex gap-0.5">
            {lens.photochromic && (
              <span className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-amber-700">
                <Sun className="h-2.5 w-2.5" />
              </span>
            )}
            {lens.progressive && (
              <span className="inline-flex items-center rounded bg-purple-100 px-1 py-0.5 text-purple-700">
                <Layers className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Type tags - compact */}
      <div className="mb-2 flex flex-wrap gap-1">
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{lens.lens_type}</span>
        {lens.index != null && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{lens.index}</span>}
        {lens.design && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{lens.design}</span>}
      </div>

      <p className="mb-2 truncate text-[11px] text-slate-400" title="Откройте карточку для полной таблицы">
        {lens.power_ranges && lens.power_ranges.length > 0
          ? `SPH/CYL: ${lens.power_ranges.length} диапазон${lens.power_ranges.length === 1 ? '' : 'а'}`
          : 'SPH/CYL ограничения не заданы'}
      </p>

      {/* Coatings truncated with title tooltip */}
      {coatingText && (
        <p className="mb-2 truncate text-[11px] text-slate-500" title={coatingText}>
          {coatingText}
        </p>
      )}

      {/* Delivery info - compact */}
      {(lens.delivery_days != null || lens.delivery_note) && (
        <div className="mb-2 flex items-center gap-1 text-[11px] text-slate-500">
          <Truck className="h-3 w-3 flex-shrink-0 text-slate-400" />
          {lens.delivery_days != null && <span>{lens.delivery_days} дн.</span>}
          {lens.delivery_note && <span className="truncate text-slate-400">{lens.delivery_note}</span>}
        </div>
      )}

      {/* Price area - prominent */}
      <div className="mt-auto border-t border-slate-100 pt-2.5">
        <div className="flex items-end justify-between">
          <div className="min-w-0">
            {saleActive && salePriceVal != null && salePriceVal < lens.price && (
              <span className="block text-[11px] text-slate-400 line-through">
                {formatPrice(lens.price)}
              </span>
            )}
            <span className={`text-xl font-bold leading-none ${saleActive ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatPrice(dispPrice)}
            </span>
            {lens.material && (
              <p className="mt-1 truncate text-[10px] text-slate-400">{lens.material}</p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAvailability(); }}
              disabled={togglingAvail}
              className="flex-shrink-0 text-[11px] text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
            >
              {togglingAvail ? <Loader2 className="h-3 w-3 animate-spin" /> : (lens.is_available ? 'Снять' : 'Вернуть')}
            </button>
          )}
        </div>
        {isAdmin && lens.purchase_price != null && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
            <span className="text-slate-400">Учёт: {formatPrice(lens.purchase_price)}</span>
            {priceDiff != null && (
              <span className={priceDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {priceDiff >= 0 ? '+' : ''}{formatPrice(priceDiff)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag2({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      {label}
    </span>
  );
}

function LensDetailModal({
  lens,
  onClose,
  formatPrice,
  onManageSale,
  isAdmin,
  onEdit,
  onCopy,
  onDelete,
  onToggleAvailability,
  togglingAvail,
}: {
  lens: Lens;
  onClose: () => void;
  formatPrice: (p: number) => string;
  onManageSale: (lens: Lens) => void;
  isAdmin: boolean;
  onEdit: (lens: Lens) => void;
  onCopy: (lens: Lens) => void;
  onDelete: (lens: Lens) => void;
  onToggleAvailability: () => void;
  togglingAvail: boolean;
}) {
  const saleActive = isSaleActive(lens);
  const salePriceVal = computeSalePrice(lens);
  const dispPrice = displayPrice(lens);
  const priceDiff = priceDifference(lens);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {lens.brand}
              </span>
              {saleActive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                  <TrendingDown className="h-3 w-3" />
                  АКЦИЯ
                </span>
              )}
              {!lens.is_available && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-400 px-2 py-0.5 text-xs font-bold text-white">
                  <EyeOff className="h-3 w-3" />
                  Снято с продажи
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{lens.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="mb-6 flex items-baseline gap-3">
            <span className={`text-2xl font-bold ${saleActive ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatPrice(dispPrice)}
            </span>
            {saleActive && salePriceVal != null && salePriceVal < lens.price && (
              <span className="text-base text-slate-400 line-through">
                {formatPrice(lens.price)}
              </span>
            )}
          </div>

          {saleActive && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                <TrendingDown className="h-4 w-4" />
                Акция действует
              </div>
              {lens.sale_note && (
                <p className="mt-2 text-sm text-rose-700">{lens.sale_note}</p>
              )}
              {lens.sale_ends_at && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  До {new Date(lens.sale_ends_at).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <DetailRow label="Тип линзы" value={lens.lens_type} />
            <DetailRow label="Дизайн" value={lens.design} />
            <DetailRow label="Материал" value={lens.material} />
            <DetailRow label="Индекс" value={lens.index ? String(lens.index) : null} />
            <DetailRow label="ЭККА" value={lens.ekka} />
            <DetailRow label="Фотохром" value={lens.photochromic ? (lens.photochromic_type ?? 'Да') : 'Нет'} />
            <DetailRow label="Прогрессивная" value={lens.progressive ? 'Да' : 'Нет'} />
            {lens.progressive && (
              <DetailRow label="Коридор" value={lens.progressive_corridor} />
            )}
            <DetailRow label="Диаметры" value={lens.diameter.length > 0 ? lens.diameter.join(', ') + ' мм' : null} />
            <DetailRow label="Контроль миопии" value={lens.myopia_control ? 'Да' : 'Нет'} />
            <DetailRow label="Срок поставки" value={lens.delivery_days != null ? `${lens.delivery_days} дн.` : null} />
            <DetailRow label="Примечание поставки" value={lens.delivery_note} />
          </div>

          {lens.power_ranges && lens.power_ranges.length > 0 ? (
            <PowerRangesTable ranges={lens.power_ranges} />
          ) : (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold text-amber-800">Ограничения SPH/CYL не заданы</p>
              <p className="mt-1 text-xs text-amber-700">Для этой линзы сохраняется совместимость со старыми общими диапазонами.</p>
              {(lens.sph_range || lens.cyl_range) && <p className="mt-2 text-xs text-amber-800">{lens.sph_range ?? '—'} · {lens.cyl_range ?? '—'}</p>}
            </div>
          )}

          {isAdmin && lens.purchase_price != null && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-400">Учётная цена</p>
                  <p className="text-sm font-semibold text-slate-700">{formatPrice(lens.purchase_price)}</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-400">{saleActive ? 'Цена акции' : 'РРЦ'}</p>
                  <p className="text-sm font-semibold text-slate-700">{formatPrice(dispPrice)}</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-400">Разница</p>
                  <p className={`text-sm font-bold ${priceDiff != null && priceDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {priceDiff != null ? (priceDiff >= 0 ? '+' : '') + formatPrice(priceDiff) : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {lens.coating.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Покрытия
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lens.coating.map((c) => (
                  <span
                    key={c}
                    className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lens.notes && (
            <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <p className="text-sm text-slate-600">{lens.notes}</p>
            </div>
          )}

          {/* Admin buttons */}
          {isAdmin && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onEdit(lens)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" />
                Редактировать
              </button>
              <button
                onClick={() => onCopy(lens)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                Копировать
              </button>
              <button
                onClick={() => onManageSale(lens)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  saleActive
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }`}
              >
                <Tag className="h-4 w-4" />
                {saleActive ? 'Изменить акцию' : 'Назначить акцию'}
              </button>
              <button
                onClick={onToggleAvailability}
                disabled={togglingAvail}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                  lens.is_available
                    ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {togglingAvail ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                {lens.is_available ? 'Снять с продажи' : 'Вернуть в продажу'}
              </button>
              <button
                onClick={() => onDelete(lens)}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PowerRangesTable({ ranges }: { ranges: LensPowerRange[] }) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Допустимые диапазоны SPH/CYL</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400"><tr><th className="pb-2 pr-3 font-medium">SPH</th><th className="pb-2 pr-3 font-medium">Шаг</th><th className="pb-2 pr-3 font-medium">CYL</th><th className="pb-2 font-medium">Шаг</th></tr></thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {ranges.map((range) => (
              <tr key={range.id}>
                <td className="py-2 pr-3">{range.sph_min.toFixed(2)} … {range.sph_max.toFixed(2)}</td>
                <td className="py-2 pr-3">{range.sph_step.toFixed(2)}</td>
                <td className="py-2 pr-3">{range.cyl_min.toFixed(2)} … {range.cyl_max.toFixed(2)}</td>
                <td className="py-2">{range.cyl_step.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ranges.some((range) => range.allowed_combinations.length > 0) && (
        <p className="mt-3 text-xs text-slate-500">Точные пары: {ranges.flatMap((range) => range.allowed_combinations.map((pair) => `${pair.sph.toFixed(2)}/${pair.cyl.toFixed(2)}`)).join(', ')}</p>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value ?? '—'}</p>
    </div>
  );
}

function ColumnResizer({
  columnKey,
  width,
  onResize,
}: {
  columnKey: ColumnKey;
  width: number;
  onResize: (key: ColumnKey, newWidth: number) => void;
}) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      onResize(columnKey, startWidthRef.current + delta);
    };
    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, columnKey, onResize]);

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        setIsDragging(true);
      }}
      className="absolute right-0 top-0 z-10 flex h-full w-1.5 cursor-col-resize items-center justify-center hover:bg-blue-400"
      style={isDragging ? { background: 'rgba(59,130,246,0.5)' } : undefined}
    >
      <MoveHorizontal className="h-3 w-3 text-slate-300" />
    </div>
  );
}

function LensListHeader({
  isAdmin,
  bulkMode,
  visibleColumns,
  columnWidths,
  onColumnResize,
  allSelectedOnPage,
  onToggleAll,
}: {
  isAdmin: boolean;
  bulkMode: boolean;
  visibleColumns: ColumnKey[];
  columnWidths: Record<ColumnKey, number>;
  onColumnResize: (key: ColumnKey, newWidth: number) => void;
  allSelectedOnPage: boolean;
  onToggleAll: () => void;
}) {
  const baseTh = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap';
  const colLabels: Record<ColumnKey, string> = {
    brand: 'Бренд', name: 'Название', lens_type: 'Тип', index: 'Индекс',
    design: 'Дизайн', material: 'Материал', price: 'Цена', sale: 'Акция',
    delivery: 'Поставка', status: 'Статус', coating: 'Покрытия',
    sph_range: 'Сфера', cyl_range: 'Цилиндр', diameter: 'Диаметр',
    photochromic: 'Фотохром', progressive: 'Прогрессив', notes: 'Примечания',
    purchase_price: 'Учёт. цена', price_diff: 'Разница',
    ekka: 'ЭККА', myopia_control: 'Контр. миопии',
  };
  return (
    <div className="flex border-b border-slate-200 bg-slate-50">
      <div className={`${baseTh} w-10 flex-shrink-0`}>
        {bulkMode ? (
          <button onClick={onToggleAll} className="flex items-center justify-center">
            {allSelectedOnPage ? (
              <CheckSquare className="h-4 w-4 text-indigo-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
          </button>
        ) : null}
      </div>
      {visibleColumns.map((col) => (
        <div
          key={col}
          className={`${baseTh} relative flex-shrink-0`}
          style={{ width: columnWidths[col] }}
        >
          <span className="block overflow-hidden text-ellipsis">{colLabels[col]}</span>
          <ColumnResizer columnKey={col} width={columnWidths[col]} onResize={onColumnResize} />
        </div>
      ))}
    </div>
  );
}

const INLINE_EDITABLE: Record<string, 'text' | 'number' | 'boolean'> = {
  brand: 'text',
  name: 'text',
  design: 'text',
  material: 'text',
  lens_type: 'text',
  price: 'number',
  purchase_price: 'number',
  delivery_days: 'number',
  delivery_note: 'text',
  notes: 'text',
  sph_range: 'text',
  cyl_range: 'text',
  index: 'number',
  ekka: 'text',
};

function LensListRow({
  lens,
  onClick,
  formatPrice,
  bulkMode,
  isSelected,
  onToggleSelect,
  isAdmin,
  editMode,
  visibleColumns,
  columnWidths,
  editingCell,
  onEditCell,
  onInlineEdit,
  onToggleAvailability,
  togglingAvail,
}: {
  lens: Lens;
  onClick: () => void;
  formatPrice: (p: number) => string;
  bulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isAdmin: boolean;
  editMode: boolean;
  visibleColumns: ColumnKey[];
  columnWidths: Record<ColumnKey, number>;
  editingCell: { id: string; field: string } | null;
  onEditCell: (field: string) => void;
  onInlineEdit: (id: string, field: string, value: string | number | boolean | null) => void;
  onToggleAvailability: () => void;
  togglingAvail: boolean;
}) {
  const saleActive = isSaleActive(lens);
  const salePriceVal = computeSalePrice(lens);
  const dispPrice = displayPrice(lens);
  const priceDiff = priceDifference(lens);
  const isEditing = editingCell?.id === lens.id;
  const editField = isEditing ? editingCell!.field : null;
  const editType = editField ? INLINE_EDITABLE[editField] : undefined;

  const renderCell = (field: string, displayValue: React.ReactNode) => {
    if (!isAdmin || !editMode || !INLINE_EDITABLE[field] || editField !== field) {
      return <span>{displayValue}</span>;
    }
    if (editType === 'boolean') {
      return <span>{displayValue}</span>;
    }
    const currentValue = String((lens as Record<string, unknown>)[field] ?? '');
    return (
      <input
        autoFocus
        type={editType === 'number' ? 'number' : 'text'}
        defaultValue={currentValue}
        onBlur={(e) => {
          const raw = e.target.value;
          const val = editType === 'number' ? (raw === '' ? null : Number(raw)) : (raw || null);
          onInlineEdit(lens.id, field, val as string | number | boolean | null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') onEditCell('');
        }}
        className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    );
  };

  const cellClass = 'px-3 py-2.5 text-sm text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap flex-shrink-0';

  const renderColumnCell = (col: ColumnKey): React.ReactNode => {
    switch (col) {
      case 'brand':
        return <div className={cellClass} data-field="brand" style={{ width: columnWidths[col] }}>{renderCell('brand', lens.brand)}</div>;
      case 'name':
        return <div className={cellClass} data-field="name" style={{ width: columnWidths[col] }}>{renderCell('name', lens.name)}</div>;
      case 'lens_type':
        return <div className={cellClass} data-field="lens_type" style={{ width: columnWidths[col] }}>{renderCell('lens_type', lens.lens_type)}</div>;
      case 'index':
        return <div className={cellClass} data-field="index" style={{ width: columnWidths[col] }}>{renderCell('index', lens.index ? String(lens.index) : '—')}</div>;
      case 'design':
        return <div className={cellClass} data-field="design" style={{ width: columnWidths[col] }}>{renderCell('design', lens.design ?? '—')}</div>;
      case 'material':
        return <div className={cellClass} data-field="material" style={{ width: columnWidths[col] }}>{renderCell('material', lens.material ?? '—')}</div>;
      case 'price':
        return (
          <div className={`${cellClass} font-semibold`} data-field="price" style={{ width: columnWidths[col] }}>
            {renderCell('price', formatPrice(dispPrice))}
          </div>
        );
      case 'sale':
        return (
          <div className={cellClass} style={{ width: columnWidths[col] }}>
            {saleActive ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                {lens.sale_discount_type === 'percent' && lens.sale_discount_value != null
                  ? `-${lens.sale_discount_value}%`
                  : saleActive && salePriceVal != null && salePriceVal < lens.price
                  ? `-${Math.round((1 - salePriceVal / lens.price) * 100)}%`
                  : 'АКЦИЯ'}
              </span>
            ) : '—'}
          </div>
        );
      case 'delivery':
        return (
          <div className={cellClass} data-field="delivery_days" style={{ width: columnWidths[col] }}>
            {renderCell('delivery_days', lens.delivery_days != null ? `${lens.delivery_days} дн.` : lens.delivery_note ?? '—')}
          </div>
        );
      case 'status':
        return (
          <div className={cellClass} style={{ width: columnWidths[col] }}>
            {lens.is_available ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">В продаже</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <EyeOff className="h-3 w-3" /> Снято
              </span>
            )}
          </div>
        );
      case 'coating':
        return <div className={cellClass} style={{ width: columnWidths[col] }}>{lens.coating.length > 0 ? lens.coating.join(', ') : '—'}</div>;
      case 'sph_range':
        return <div className={cellClass} data-field="sph_range" style={{ width: columnWidths[col] }}>{renderCell('sph_range', lens.sph_range ?? '—')}</div>;
      case 'cyl_range':
        return <div className={cellClass} data-field="cyl_range" style={{ width: columnWidths[col] }}>{renderCell('cyl_range', lens.cyl_range ?? '—')}</div>;
      case 'diameter':
        return <div className={cellClass} style={{ width: columnWidths[col] }}>{lens.diameter.length > 0 ? lens.diameter.join(', ') + ' мм' : '—'}</div>;
      case 'photochromic':
        return <div className={cellClass} style={{ width: columnWidths[col] }}>{lens.photochromic ? (lens.photochromic_type ?? 'Да') : 'Нет'}</div>;
      case 'progressive':
        return <div className={cellClass} style={{ width: columnWidths[col] }}>{lens.progressive ? 'Да' : 'Нет'}</div>;
      case 'notes':
        return <div className={cellClass} data-field="notes" style={{ width: columnWidths[col] }}>{renderCell('notes', lens.notes ?? '—')}</div>;
      case 'purchase_price':
        return (
          <div className={cellClass} data-field="purchase_price" style={{ width: columnWidths[col] }}>
            {renderCell('purchase_price', lens.purchase_price != null ? formatPrice(lens.purchase_price) : '—')}
          </div>
        );
      case 'price_diff':
        return (
          <div className={`${cellClass} font-medium ${priceDiff != null && priceDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={{ width: columnWidths[col] }}>
            {priceDiff != null ? (priceDiff >= 0 ? '+' : '') + formatPrice(priceDiff) : '—'}
          </div>
        );
      case 'ekka':
        return <div className={cellClass} data-field="ekka" style={{ width: columnWidths[col] }}>{renderCell('ekka', lens.ekka ?? '—')}</div>;
      case 'myopia_control':
        return <div className={cellClass} style={{ width: columnWidths[col] }}>{lens.myopia_control ? 'Да' : 'Нет'}</div>;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={bulkMode ? onToggleSelect : editMode ? undefined : onClick}
      onDoubleClick={(e) => {
        if (!isAdmin || !editMode || bulkMode) return;
        const target = (e.target as HTMLElement).closest('[data-field]') as HTMLElement | null;
        if (target) {
          const field = target.dataset.field;
          if (field && INLINE_EDITABLE[field]) onEditCell(field);
        }
      }}
      className={`flex border-b border-slate-100 transition hover:bg-slate-50 ${
        !lens.is_available ? 'opacity-50' : ''
      } ${bulkMode && isSelected ? 'bg-indigo-50/50' : ''} ${
        editMode && !bulkMode ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <div className="flex w-10 flex-shrink-0 items-center justify-center px-3 py-2.5">
        {bulkMode ? (
          isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-300" />
        ) : null}
      </div>
      {visibleColumns.map((col) => (
        <div key={col}>{renderColumnCell(col)}</div>
      ))}
    </div>
  );
}
