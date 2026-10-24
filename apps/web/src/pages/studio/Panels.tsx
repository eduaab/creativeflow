import {
  COLOR_LABELS,
  COLOR_TOKENS,
  PALETTE_FOR_EDITOR,
  PROTECTED_CONTENT_ROLES,
  ROLE_LABELS,
  formatBRL,
  formatDateBR,
  resolveLayerText,
  type ColorToken,
  type CreativeDoc,
  type Layer,
  type PatchOp,
  type RenderContext,
  type RuleCategory,
  type ValidationReport,
} from '@cf/shared';
import clsx from 'clsx';
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  Lock,
  OctagonX,
  Shapes,
  Sparkles,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* ------------------------------ Camadas --------------------------- */
const ROLE_ICON: Partial<Record<Layer['role'], ReactNode>> = {
  'product-image': <ImageIcon className="h-3.5 w-3.5" />,
  price: <Tag className="h-3.5 w-3.5" />,
  decor: <Shapes className="h-3.5 w-3.5" />,
  card: <Shapes className="h-3.5 w-3.5" />,
};

export function LayersPanel({ doc, selectedId, onSelect, onToggleHidden, flagged }: { doc: CreativeDoc; selectedId: string | null; onSelect: (id: string) => void; onToggleHidden: (l: Layer) => void; flagged: Set<string> }) {
  const layers = [...doc.layers].sort((a, b) => b.z - a.z);
  return (
    <div className="space-y-0.5">
      {layers.map((l) => {
        const locked = !!l.binding || PROTECTED_CONTENT_ROLES.includes(l.role);
        return (
          <div
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={clsx('group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs', selectedId === l.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-100', l.hidden && 'opacity-50')}
          >
            <span className="text-slate-400">{ROLE_ICON[l.role] ?? <Type className="h-3.5 w-3.5" />}</span>
            <span className="flex-1 truncate">
              {ROLE_LABELS[l.role]}
              <span className="ml-1 text-slate-400">{l.id.startsWith('s') && l.id.includes('-') ? l.id.split('-')[0] : ''}</span>
            </span>
            {flagged.has(l.id) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            {locked && <Lock className="h-3 w-3 text-slate-400" aria-label="conteúdo travado" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden(l);
              }}
              className="text-slate-400 opacity-0 hover:text-slate-700 group-hover:opacity-100"
              aria-label="Mostrar/ocultar"
            >
              {l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- Propriedades ------------------------- */
function Swatches({ value, onChange, allowNone }: { value?: string; onChange: (v: ColorToken | null) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
        <button onClick={() => onChange(null)} className={clsx('h-6 w-6 rounded border text-[10px] text-slate-400', !value ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-slate-300')} title="sem cor">
          ∅
        </button>
      )}
      {PALETTE_FOR_EDITOR.map((t) => (
        <button key={t} title={COLOR_LABELS[t]} onClick={() => onChange(t)} className={clsx('h-6 w-6 rounded border border-slate-300', value === t && 'ring-2 ring-blue-500 ring-offset-1')} style={{ background: COLOR_TOKENS[t] }} />
      ))}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">
      <span className="w-3 text-slate-400">{label}</span>
      <input type="number" className="w-full bg-transparent outline-none" value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function PropertiesPanel({ layer, ctx, push, readOnly }: { layer: Layer | undefined; ctx: RenderContext; push: (op: PatchOp) => void; readOnly: boolean }) {
  if (!layer) return <div className="p-4 text-center text-xs text-slate-500">Selecione uma camada no canvas ou na lista para editar.</div>;
  const set = (path: string, value: string | number | boolean | null) => push({ op: 'set', layerId: layer.id, path, value });
  const s = layer.style;
  const bound = !!layer.binding;
  const isText = layer.kind === 'text';
  const offer = layer.binding?.sku ? ctx.offers[layer.binding.sku] : undefined;

  return (
    <fieldset disabled={readOnly} className="space-y-4 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{ROLE_LABELS[layer.role]}</div>
        <code className="text-[11px] text-slate-400">{layer.id}</code>
      </div>

      {(bound || PROTECTED_CONTENT_ROLES.includes(layer.role)) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
            <Lock className="h-3.5 w-3.5" /> Dado {layer.binding?.source === 'offer' ? 'comercial' : layer.binding?.source === 'legal' ? 'legal' : 'do catálogo/marca'} — conteúdo travado
          </div>
          {layer.kind === 'price-tag' && offer && (
            <div className="space-y-0.5 text-slate-600">
              <div>
                Oferta <strong>{offer.id}</strong> · {formatBRL(offer.priceCents)}
                {offer.listPriceCents ? ` (de ${formatBRL(offer.listPriceCents)})` : ''}
              </div>
              <div>
                Vigência {formatDateBR(offer.startsAt)} a {formatDateBR(offer.endsAt)} · {ctx.praca.name}
              </div>
            </div>
          )}
          {layer.kind === 'price-tag' && !offer && <div className="text-red-700">Sem oferta cadastrada para esta praça. Nenhum preço alternativo é preenchido.</div>}
          {isText && <div className="text-slate-600">“{resolveLayerText(layer, ctx)}”</div>}
          <div className="mt-1.5 text-slate-500">Para corrigir o conteúdo, atualize a fonte de origem (cadastro de ofertas/catálogo). Aqui você pode ajustar posição{isText || layer.kind === 'price-tag' ? ' e estilo' : ''}.</div>
        </div>
      )}

      {isText && !bound && (
        <div>
          <label className="label">Texto criativo</label>
          <textarea className="input" rows={3} value={layer.text ?? ''} onChange={(e) => set('text', e.target.value)} />
          <div className="mt-1 text-right text-[11px] text-slate-400">{(layer.text ?? '').length} caracteres</div>
        </div>
      )}

      {isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Fonte</label>
              <select className="input py-1.5" value={s.font ?? 'body'} onChange={(e) => set('style.font', e.target.value)}>
                <option value="display">Nunito (títulos)</option>
                <option value="body">Inter (texto)</option>
              </select>
            </div>
            <div>
              <label className="label">Peso</label>
              <select className="input py-1.5" value={s.fontWeight ?? 400} onChange={(e) => set('style.fontWeight', Number(e.target.value))}>
                {[400, 500, 600, 700, 800].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Tamanho: {Math.round(s.fontSize ?? 24)}px</label>
            <input type="range" min={10} max={200} value={s.fontSize ?? 24} onChange={(e) => set('style.fontSize', Number(e.target.value))} className="w-full accent-brand-600" />
          </div>
          <div className="flex gap-1">
            {(
              [
                ['left', <AlignLeft key="l" className="h-4 w-4" />],
                ['center', <AlignCenter key="c" className="h-4 w-4" />],
                ['right', <AlignRight key="r" className="h-4 w-4" />],
              ] as const
            ).map(([a, icon]) => (
              <button key={a} onClick={() => set('style.align', a)} className={clsx('rounded-md border px-2 py-1', (s.align ?? 'left') === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300')}>
                {icon}
              </button>
            ))}
            <button onClick={() => set('style.uppercase', !s.uppercase)} className={clsx('rounded-md border px-2 py-1 text-xs font-semibold', s.uppercase ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300')}>
              AA
            </button>
          </div>
          <div>
            <label className="label">Cor do texto</label>
            <Swatches value={s.color} onChange={(t) => set('style.color', t)} />
          </div>
          {(s.bg || layer.role === 'cta' || layer.role === 'badge' || layer.role === 'extra-text') && (
            <div>
              <label className="label">Fundo</label>
              <Swatches value={s.bg} onChange={(t) => set('style.bg', t)} allowNone />
            </div>
          )}
        </>
      )}

      {layer.kind === 'price-tag' && (
        <div>
          <label className="label">Cor da etiqueta</label>
          <Swatches value={s.bg} onChange={(t) => set('style.bg', t)} />
        </div>
      )}
      {layer.kind === 'shape' && (
        <>
          <div>
            <label className="label">Preenchimento</label>
            <Swatches value={s.fill} onChange={(t) => set('style.fill', t)} />
          </div>
          <div>
            <label className="label">Opacidade: {Math.round((s.opacity ?? 1) * 100)}%</label>
            <input type="range" min={0} max={100} value={(s.opacity ?? 1) * 100} onChange={(e) => set('style.opacity', Number(e.target.value) / 100)} className="w-full accent-brand-600" />
          </div>
        </>
      )}

      <div>
        <label className="label">Posição e tamanho (px)</label>
        <div className="grid grid-cols-2 gap-1.5">
          <Num label="X" value={layer.x} onChange={(n) => set('x', n)} />
          <Num label="Y" value={layer.y} onChange={(n) => set('y', n)} />
          <Num label="L" value={layer.w} onChange={(n) => set('w', n)} />
          <Num label="A" value={layer.h} onChange={(n) => set('h', n)} />
        </div>
      </div>
      {['decor', 'badge', 'extra-text', 'subheadline', 'cta', 'card'].includes(layer.role) && (
        <button onClick={() => push({ op: 'remove', layerId: layer.id })} className="flex items-center gap-1.5 text-xs text-red-600 hover:underline">
          <Trash2 className="h-3.5 w-3.5" /> Remover camada
        </button>
      )}
    </fieldset>
  );
}

/* ----------------------------- Validação -------------------------- */
const CAT_LABEL: Record<RuleCategory, string> = { comercial: 'Dados comerciais', marca: 'Marca', formato: 'Formato e legibilidade', regulatorio: 'Conteúdo e regulatório' };

export function ValidationPanel({ report, onSelectLayer, title }: { report: ValidationReport | null; onSelectLayer: (id: string) => void; title: ReactNode }) {
  if (!report) return <div className="p-4 text-xs text-slate-500">Sem validação.</div>;
  const cats = Object.keys(CAT_LABEL) as RuleCategory[];
  const passedCount = report.results.filter((r) => r.passed).length;
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="mt-2 flex gap-2">
          <span className="flex-1 rounded-lg bg-red-50 p-2 text-center">
            <div className="font-display text-lg font-semibold text-red-700">{report.counts.critico}</div>
            <div className="text-[10px] uppercase text-red-700">crítico</div>
          </span>
          <span className="flex-1 rounded-lg bg-amber-50 p-2 text-center">
            <div className="font-display text-lg font-semibold text-amber-700">{report.counts.alerta}</div>
            <div className="text-[10px] uppercase text-amber-700">alerta</div>
          </span>
          <span className="flex-1 rounded-lg bg-emerald-50 p-2 text-center">
            <div className="font-display text-lg font-semibold text-emerald-700">{passedCount}</div>
            <div className="text-[10px] uppercase text-emerald-700">ok</div>
          </span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400">{report.rulesVersion}</div>
      </div>
      {cats.map((c) => {
        const items = report.results.filter((r) => r.category === c).sort((a, b) => Number(a.passed) - Number(b.passed));
        if (!items.length) return null;
        return (
          <div key={c}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{CAT_LABEL[c]}</div>
            <div className="space-y-1">
              {items.map((r, i) => (
                <button
                  key={`${r.ruleId}-${i}`}
                  onClick={() => r.layerId && onSelectLayer(r.layerId)}
                  className={clsx('flex w-full gap-2 rounded-md p-2 text-left text-xs', r.passed ? 'text-slate-600' : r.severity === 'critico' ? 'bg-red-50 text-red-800' : r.severity === 'alerta' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900')}
                >
                  {r.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : r.severity === 'critico' ? <OctagonX className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : r.severity === 'alerta' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>
                    <span className="font-medium">{r.ruleId}</span> · {r.passed ? r.title : r.message}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const SUGGESTIONS = ['Encurte o título e mantenha a oferta', 'Destaque o produto sem mexer na oferta', 'Dê mais espaço ao CTA', 'Troque o produto de lado', 'Título em laranja', 'Mude o preço para R$ 19,90', 'Publique agora sem aprovação'];

export function AiBadge({ provider, fallback }: { provider: string; fallback?: boolean }) {
  const demo = provider === 'mock' || provider === 'regra';
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', demo ? 'bg-amber-50 text-amber-800' : 'bg-violet-50 text-violet-700')}>
      <Sparkles className="h-3 w-3" />
      {provider === 'regra' ? 'barreira de regras' : demo ? 'modo demonstração' : provider}
      {fallback ? ' (contingência)' : ''}
    </span>
  );
}
