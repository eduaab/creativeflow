import { STATUS_LABELS, type CreativeStatus } from '@cf/shared';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { STATUS_DOT, STATUS_STYLE } from '../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'ai';
export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
        variant === 'ai' && 'bg-gradient-to-r from-violet-600 to-brand-600 text-white hover:opacity-90',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Badge({ children, className, tone = 'slate' }: { children: ReactNode; className?: string; tone?: 'slate' | 'brand' | 'violet' | 'amber' | 'red' | 'emerald' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function StatusBadge({ status, className }: { status: CreativeStatus; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status], className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
      <Spinner /> {text}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(error as Error)?.message ?? 'Erro ao carregar.'}</div>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'amber' | 'red' | 'emerald' }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx('mt-1 font-display text-2xl font-semibold', tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-slate-900')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div className={clsx('flex max-h-[92vh] w-full flex-col rounded-xl bg-white shadow-xl', wide ? 'max-w-6xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition', value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <div className="font-semibold text-slate-800">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span className={clsx('relative h-5 w-9 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')} onClick={() => onChange(!checked)}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}
