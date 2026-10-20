import type { CreativeStatus } from '@cf/shared';

export const STATUS_STYLE: Record<CreativeStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-700 border-slate-200',
  bloqueado: 'bg-red-50 text-red-700 border-red-200',
  aguardando_conceito: 'bg-violet-50 text-violet-700 border-violet-200',
  aguardando_revisao: 'bg-amber-50 text-amber-800 border-amber-200',
  ajustes_solicitados: 'bg-orange-50 text-orange-800 border-orange-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  aprovado_por_heranca: 'bg-teal-50 text-teal-700 border-teal-200',
};

export const STATUS_DOT: Record<CreativeStatus, string> = {
  rascunho: 'bg-slate-400',
  bloqueado: 'bg-red-500',
  aguardando_conceito: 'bg-violet-500',
  aguardando_revisao: 'bg-amber-500',
  ajustes_solicitados: 'bg-orange-500',
  aprovado: 'bg-emerald-500',
  aprovado_por_heranca: 'bg-teal-500',
};

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
export const ORIGIN_LABEL = { derivada: 'Gerada pelo template', manual: 'Edição manual', ia: 'Edição por IA' } as const;
