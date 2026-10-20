import clsx from 'clsx';
import type { AuditEvent } from '../api/client';
import { auditDetail, auditLabel, auditTone } from '../lib/audit';
import { fmtDateTime } from '../lib/format';

const DOT = { red: 'bg-red-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', slate: 'bg-slate-400' };
const NAMES: Record<string, string> = { 'u-ana': 'Ana', 'u-rui': 'Rui', 'u-bia': 'Bia' };

export function AuditList({ events, compact }: { events: AuditEvent[]; compact?: boolean }) {
  if (!events.length) return <div className="py-6 text-center text-sm text-slate-500">Nenhum evento registrado.</div>;
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={clsx('absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white', DOT[auditTone(e.type)])} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={clsx('font-medium text-slate-800', compact ? 'text-xs' : 'text-sm')}>{auditLabel(e)}</span>
            <span className="text-[11px] text-slate-400">
              {fmtDateTime(e.createdAt)} · {e.actorId ? (NAMES[e.actorId] ?? e.actorId) : 'sistema'}
            </span>
          </div>
          {auditDetail(e) && <div className={clsx('text-slate-500', compact ? 'text-[11px]' : 'text-xs')}>{auditDetail(e)}</div>}
        </li>
      ))}
    </ol>
  );
}
