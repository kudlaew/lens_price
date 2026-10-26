import { List, LayoutGrid, Columns3, Columns2 } from 'lucide-react';

export type ViewMode = 'list' | 'grid-4' | 'grid-3' | 'grid-2';

export function ViewModeSelector({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'list', label: 'Список', icon: <List className="h-4 w-4" /> },
    { mode: 'grid-4', label: '4', icon: <LayoutGrid className="h-4 w-4" /> },
    { mode: 'grid-3', label: '3', icon: <Columns3 className="h-4 w-4" /> },
    { mode: 'grid-2', label: '2', icon: <Columns2 className="h-4 w-4" /> },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
      {modes.map((m) => (
        <button
          key={m.mode}
          onClick={() => onChange(m.mode)}
          title={m.label === 'Список' ? 'Список' : `Плитка по ${m.label}`}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition ${
            viewMode === m.mode
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}
