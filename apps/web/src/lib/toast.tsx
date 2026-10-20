import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

type Kind = 'ok' | 'warn' | 'error';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-white p-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-red-200' : t.kind === 'warn' ? 'border-amber-200' : 'border-emerald-200'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : t.kind === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
