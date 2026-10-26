import { useRef, useState, useCallback } from 'react';
import { supabase, type Lens } from '@/lib/supabase';
import { parseExcelFile, importRowsToSupabase, type ParseResult } from '@/lib/excel-import';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Loader2,
  ChevronRight,
} from 'lucide-react';

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

export function ExcelImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (newLenses: Lens[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [importResult, setImportResult] = useState<{
    inserted: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setState('parsing');
    setErrorMsg('');
    try {
      const result = await parseExcelFile(file);
      setParseResult(result);
      if (result.errors.length > 0 && result.validRows === 0) {
        setState('error');
        setErrorMsg(result.errors[0]);
      } else {
        setState('preview');
      }
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось обработать файл');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!parseResult) return;
    setState('importing');
    try {
      const result = await importRowsToSupabase(parseResult.rows);
      setImportResult(result);
      setState('done');
      if (result.inserted > 0) {
        const { data } = await supabase.from('lenses').select('*');
        if (data) onImported(data as Lens[]);
      }
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка импорта');
    }
  };

  const handleReset = () => {
    setState('idle');
    setParseResult(null);
    setFileName('');
    setErrorMsg('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const headers = [
      'Бренд',
      'Название',
      'Дизайн',
      'Материал',
      'Индекс',
      'Покрытия',
      'Фотохром',
      'Тип фотохрома',
      'Прогрессивная',
      'Коридор прогрессии',
      'Тип линзы',
      'Диапазон сферы',
      'Диапазон цилиндра',
      'Макс. сфера',
      'Макс. цилиндр',
      'Диаметр',
      'Цена',
      'Валюта',
      'Примечания',
    ];
    const exampleRow = [
      'Essilor',
      'Crizal Easy Pro',
      'Асферическая',
      'Полимерная 1.5',
      '1.5',
      'Упрочнение, Антиблик, УФ-фильтр',
      'Нет',
      '',
      'Нет',
      '',
      'Однофокальная',
      '+8.00 до -8.00',
      'до -4.00',
      '8.00',
      '4.00',
      '65, 70, 75',
      '4200',
      'RUB',
      'Базовое покрытие',
    ];
    const csv = [headers, exampleRow]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'шаблон_линз.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Загрузка прайса из Excel</h2>
              <p className="text-xs text-slate-500">Импорт линз из .xlsx или .csv файла</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {state === 'idle' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
              >
                <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  Перетащите файл сюда или нажмите для выбора
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Поддерживаются .xlsx, .xls, .csv
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Требования к файлу
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Скачать шаблон
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Первая строка — заголовки колонок. Обязательные колонки:{' '}
                  <span className="font-medium text-slate-700">Бренд</span> и{' '}
                  <span className="font-medium text-slate-700">Название</span>. Остальные
                  колонки опциональны. Заголовки распознаются на русском и английском.
                </p>
              </div>
            </div>
          )}

          {state === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-600">Обработка файла...</p>
              <p className="mt-1 text-xs text-slate-400">{fileName}</p>
            </div>
          )}

          {state === 'preview' && parseResult && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">{fileName}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-2xl font-bold text-slate-900">{parseResult.totalRows}</p>
                    <p className="text-xs text-slate-500">Всего строк</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-2xl font-bold text-emerald-600">{parseResult.validRows}</p>
                    <p className="text-xs text-slate-500">Готово к импорту</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-2xl font-bold text-amber-600">
                      {parseResult.totalRows - parseResult.validRows}
                    </p>
                    <p className="text-xs text-slate-500">Пропущено</p>
                  </div>
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-800">
                      {parseResult.errors[0]}
                    </p>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Бренд</th>
                      <th className="px-3 py-2 text-left font-medium">Название</th>
                      <th className="px-3 py-2 text-left font-medium">Тип</th>
                      <th className="px-3 py-2 text-right font-medium">Цена</th>
                      <th className="px-3 py-2 text-center font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.rows.slice(0, 20).map((row) => {
                      const valid = row.data.brand && row.data.name;
                      return (
                        <tr key={row.rowNumber} className={valid ? '' : 'bg-amber-50/50'}>
                          <td className="px-3 py-2 text-xs text-slate-400">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-slate-700">{row.data.brand ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{row.data.name ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.data.lens_type ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {row.data.price != null
                              ? new Intl.NumberFormat('ru-RU').format(row.data.price)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {valid ? (
                              <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="mx-auto h-4 w-4 text-amber-500" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parseResult.rows.length > 20 && (
                  <p className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
                    ... и ещё {parseResult.rows.length - 20} строк
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Выбрать другой файл
                </button>
                <button
                  onClick={handleImport}
                  disabled={parseResult.validRows === 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Импортировать {parseResult.validRows} строк
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {state === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-600">Импорт в базу данных...</p>
              <p className="mt-1 text-xs text-slate-400">{fileName}</p>
            </div>
          )}

          {state === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">Импорт завершён</p>
                <p className="mt-1 text-sm text-slate-500">
                  Добавлено {importResult.inserted} линз в каталог
                </p>
                {importResult.failed > 0 && (
                  <p className="mt-1 text-sm text-amber-600">
                    Не удалось импортировать: {importResult.failed}
                  </p>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                    <div className="space-y-1">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-amber-800">{err}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Готово
                </button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <p className="text-lg font-bold text-slate-900">Ошибка</p>
                <p className="mt-1 text-sm text-slate-500">{errorMsg}</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
