import {
  MESSAGE_FIELDS,
  MESSAGE_LABELS,
  MESSAGE_LIMITS,
  composeMessages,
  defaultMessages,
  validateMessages,
  type ChannelMessages,
  type CopyVariant,
  type MessageField,
} from '@cf/shared';
import clsx from 'clsx';
import { Bell, ChevronDown, Mail, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CampaignDetail } from '../api/client';
import { ctxFor } from '../lib/ctx';
import { Badge } from './ui';

const ICON: Record<MessageField, typeof Bell> = {
  pushTitle: Bell,
  pushBody: Bell,
  emailSubject: Mail,
  emailPreheader: Mail,
  whatsapp: MessageCircle,
};

/**
 * Textos do mesmo conceito para push, e-mail e WhatsApp. A IA escreve o texto criativo;
 * a prévia mostra a mensagem final com preço, vigência e advertência vindos do cadastro da praça.
 */
export function ChannelTexts({ variant, d, editable, onChange }: { variant: CopyVariant; d: CampaignDetail; editable: boolean; onChange: (m: ChannelMessages) => void }) {
  const [open, setOpen] = useState(false);
  const [praca, setPraca] = useState(d.campaign.briefing.pracas[0]);
  const m = variant.messages ?? defaultMessages(variant);
  const products = useMemo(() => d.campaign.briefing.skus.map((s) => d.context.products[s]).filter(Boolean), [d]);
  const issues = useMemo(() => validateMessages(m, products), [m, products]);
  const critical = issues.filter((i) => i.severity === 'critico').length;
  const composed = useMemo(() => composeMessages(m, ctxFor(d.context, praca, d.campaign.briefing.skus), d.campaign.briefing.skus, d.campaign.briefing.ctaUrl), [m, praca, d]);

  return (
    <div className="md:col-span-2 rounded-lg border border-slate-200">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2 font-medium">
          <MessageCircle className="h-4 w-4 text-brand-600" /> Textos por canal
          <span className="text-xs font-normal text-slate-500">push · e-mail · WhatsApp</span>
        </span>
        <span className="flex items-center gap-2">
          {critical > 0 ? <Badge tone="red">{critical} bloqueio(s)</Badge> : issues.length > 0 ? <Badge tone="amber">{issues.length} alerta(s)</Badge> : <Badge tone="emerald">regras ok</Badge>}
          <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-3 lg:grid-cols-2">
          <div className="space-y-2">
            {MESSAGE_FIELDS.map((f) => {
              const Icon = ICON[f];
              const val = m[f] ?? '';
              const over = val.length > MESSAGE_LIMITS[f];
              const fieldIssues = issues.filter((i) => i.layerId === `msg:${f}`);
              return (
                <div key={f}>
                  <label className="label flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Icon className="h-3 w-3" /> {MESSAGE_LABELS[f]}
                    </span>
                    <span className={clsx('tabular-nums', over ? 'text-red-600' : 'text-slate-400')}>
                      {val.length}/{MESSAGE_LIMITS[f]}
                    </span>
                  </label>
                  {f === 'whatsapp' ? (
                    <textarea className="input" rows={3} disabled={!editable} value={val} onChange={(e) => onChange({ ...m, [f]: e.target.value })} />
                  ) : (
                    <input className="input" disabled={!editable} value={val} onChange={(e) => onChange({ ...m, [f]: e.target.value })} />
                  )}
                  {fieldIssues.map((i, k) => (
                    <div key={k} className={clsx('mt-0.5 text-[11px]', i.severity === 'critico' ? 'text-red-600' : 'text-amber-700')}>
                      {i.ruleId}: {i.message}
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="text-[11px] text-slate-500">Escreva sem preço: valores, vigência, advertência e link entram automaticamente a partir do cadastro de cada praça.</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Prévia final</span>
              <select className="input w-auto py-1 text-xs" value={praca} onChange={(e) => setPraca(e.target.value)}>
                {d.campaign.briefing.pracas.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-800 p-3 text-white shadow-sm">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Notificação do app</div>
                <div className="text-sm font-semibold">{composed.pushTitle}</div>
                <div className="text-xs text-slate-200">{composed.pushBody}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Caixa de entrada</div>
                <div className="font-semibold text-slate-800">{composed.emailSubject}</div>
                <div className="truncate text-slate-500">{composed.emailPreheader}</div>
              </div>
              <div className="rounded-xl bg-[#e7f6e9] p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-800/70">WhatsApp</div>
                <div className="whitespace-pre-wrap rounded-lg bg-white p-2 text-xs text-slate-800 shadow-sm">{composed.whatsapp}</div>
              </div>
              {composed.missing.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                  Sem oferta válida em {praca}: {composed.missing.join(', ')}. Ficam fora da mensagem; nenhum preço é inventado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
