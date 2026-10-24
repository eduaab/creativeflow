import {
  FORMATS,
  ROLE_LABELS,
  applyOps,
  diffDocs,
  filterOps,
  validateCreative,
  type DiffEntry,
  type Layer,
  type PatchOp,
} from '@cf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  Eye,
  GitCompare,
  History,
  Lock,
  MessageSquare,
  Redo2,
  RotateCcw,
  Save,
  ScanEye,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Undo2,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type CreativeDetail, type CritiqueDTO, type Proposal, type VersionDTO } from '../api/client';
import { AuditList } from '../components/AuditList';
import { Thumb } from '../components/Thumb';
import { Badge, Button, ErrorBox, Loading, Modal, StatusBadge, Toggle } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { ctxFor } from '../lib/ctx';
import { ORIGIN_LABEL, fmtDateTime } from '../lib/format';
import { useToast } from '../lib/toast';
import { Canvas, type Geometry } from './studio/Canvas';
import { SemanticReview } from '../components/SemanticReview';
import { AiBadge, LayersPanel, PropertiesPanel, SUGGESTIONS, ValidationPanel } from './studio/Panels';

type RightTab = 'props' | 'copiloto' | 'regras' | 'revisao';
const NAMES: Record<string, string> = { 'u-ana': 'Ana', 'u-rui': 'Rui', 'u-bia': 'Bia' };

export function StudioPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['creative', id], queryFn: () => api.creative(id) });
  const campaignId = q.data?.creative.campaignId;
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.campaign(campaignId!), enabled: !!campaignId });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });

  const [ops, setOps] = useState<PatchOp[]>([]);
  const [redo, setRedo] = useState<PatchOp[][]>([]);
  const [history, setHistory] = useState<PatchOp[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<RightTab>('props');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showSafe, setShowSafe] = useState(false);
  const [compare, setCompare] = useState<VersionDTO | null>(null);
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    setOps([]);
    setHistory([]);
    setRedo([]);
    setProposal(null);
    setSelected(null);
  }, [id]);

  const current = q.data?.creative.current ?? null;
  const ctx = useMemo(() => (q.data ? ctxFor(q.data.context, q.data.creative.praca, q.data.creative.skus) : null), [q.data]);
  const working = useMemo(() => (current ? applyOps(current.doc, ops) : null), [current, ops]);
  const displayed = proposal?.previewDoc && showPreview ? proposal.previewDoc : working;
  const segment = catalog.data?.segments.find((s) => s.id === q.data?.creative.segmentId);
  const localReport = useMemo(() => (working && ctx && ops.length ? validateCreative(working, ctx, { segment, extra: current?.validation?.results.filter((r) => r.ruleId === 'IA-001') }) : null), [working, ctx, ops.length, segment]);
  const report = proposal?.validation && showPreview ? proposal.validation : (localReport ?? current?.validation ?? null);
  const flagged = new Set((report?.results ?? []).filter((r) => !r.passed && r.severity !== 'info' && r.layerId).map((r) => r.layerId!));
  const readOnly = !can(user, 'criador') || !!proposal;

  const pushOp = useCallback(
    (op: PatchOp) => {
      if (!working) return;
      const { rejected } = filterOps(working, [op]);
      if (rejected.length) {
        toast(rejected[0].reason, rejected[0].protectedField ? 'error' : 'warn');
        return;
      }
      setHistory((h) => [...h, ops]);
      setRedo([]);
      setOps((prev) => {
        const last = prev[prev.length - 1];
        if (op.op === 'set' && last?.op === 'set' && last.layerId === op.layerId && last.path === op.path) return [...prev.slice(0, -1), op];
        return [...prev, op];
      });
    },
    [working, ops, toast],
  );

  const commitGeometry = useCallback(
    (layerId: string, from: Geometry, to: Geometry) => {
      const next: PatchOp[] = [];
      (['x', 'y', 'w', 'h'] as const).forEach((k) => from[k] !== to[k] && next.push({ op: 'set', layerId, path: k, value: to[k] }));
      if (!next.length || !working) return;
      setHistory((h) => [...h, ops]);
      setRedo([]);
      setOps((prev) => [...prev, ...next]);
    },
    [ops, working],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setRedo((r) => [...r, ops]);
      setOps(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, [ops]);
  const redoFn = useCallback(() => {
    setRedo((r) => {
      if (!r.length) return r;
      setHistory((h) => [...h, ops]);
      setOps(r[r.length - 1]);
      return r.slice(0, -1);
    });
  }, [ops]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redoFn() : undo();
        return;
      }
      if (!selected || readOnly || !working) return;
      const l = working.layers.find((x) => x.id === selected);
      if (!l) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [string, number]> = { ArrowLeft: ['x', l.x - step], ArrowRight: ['x', l.x + step], ArrowUp: ['y', l.y - step], ArrowDown: ['y', l.y + step] };
      if (moves[e.key]) {
        e.preventDefault();
        pushOp({ op: 'set', layerId: l.id, path: moves[e.key][0], value: moves[e.key][1] });
      }
      if (e.key === 'Delete' || e.key === 'Backspace') pushOp({ op: 'remove', layerId: l.id });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected, readOnly, working, pushOp, undo, redoFn]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['creative', id] });
    qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
    qc.invalidateQueries({ queryKey: ['queue'] });
  };

  const save = useMutation({
    mutationFn: () => api.manualEdit(id, current!.id, ops),
    onSuccess: (r) => {
      setOps([]);
      setHistory([]);
      setRedo([]);
      refresh();
      const st = r.version.status;
      toast(st === 'bloqueado' ? `v${r.version.number} salva, mas BLOQUEADA por regra crítica. Veja a aba Regras.` : `v${r.version.number} salva. ${st === 'aguardando_revisao' ? 'Enviada para a fila de exceções (edição manual).' : ''}`, st === 'bloqueado' ? 'error' : 'ok');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const ask = useMutation({
    mutationFn: ({ text, scope }: { text: string; scope: 'piece' | 'siblings' }) => api.proposeAi(id, text, scope),
    onSuccess: (p) => {
      setProposal(p.status === 'pendente' ? p : null);
      setLastAsk(p);
      setShowPreview(true);
      setInstruction('');
      qc.invalidateQueries({ queryKey: ['creative', id] });
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const [lastAsk, setLastAsk] = useState<Proposal | null>(null);
  const [scope, setScope] = useState<'piece' | 'siblings'>('piece');
  const apply = useMutation({
    mutationFn: () => api.applyAi(proposal!.proposalId),
    onSuccess: (r) => {
      setProposal(null);
      setLastAsk(null);
      refresh();
      toast(`v${r.version.number} criada pela IA e enviada para revisão.${r.replicated.length ? ` Replicada em ${r.replicated.map((x) => x.praca).join(', ')}.` : ''}`);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const discard = useMutation({
    mutationFn: () => api.discardAi(proposal!.proposalId),
    onSuccess: () => {
      setProposal(null);
      setLastAsk(null);
    },
  });

  if (q.isLoading || !ctx) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const c = d.creative;
  const spec = FORMATS[c.format];
  const sel = displayed?.layers.find((l) => l.id === selected);
  const productName = c.skus.length > 1 ? `${c.skus.length} produtos` : d.context.products[c.skus[0]]?.name;
  const siblings = (campaign.data?.creatives ?? []).filter((x) => x.segmentId === c.segmentId && JSON.stringify(x.skus) === JSON.stringify(c.skus));
  const pendingDiff: DiffEntry[] = current && working ? diffDocs(current.doc, working) : [];

  const toggleHidden = (l: Layer) => pushOp({ op: 'set', layerId: l.id, path: 'hidden', value: !l.hidden });

  return (
    <div className="flex h-screen flex-col">
      {/* topo */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <button onClick={() => nav(`/campanhas/${c.campaignId}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-xs text-slate-500">
            <Link to={`/campanhas/${c.campaignId}`} className="hover:underline">
              {d.context.campaign.name}
            </Link>{' '}
            · {segment?.name ?? c.segmentId}
          </div>
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">
              {spec.label} · {c.praca} · {productName}
            </span>
            <StatusBadge status={c.status} />
            <span className="text-xs text-slate-400">
              v{current?.number} · {current ? ORIGIN_LABEL[current.origin] : ''}
            </span>
          </div>
        </div>
        <div className="ml-4 flex flex-1 gap-1 overflow-x-auto">
          {siblings.map((s) => (
            <Link key={s.id} to={`/pecas/${s.id}`} className={clsx('whitespace-nowrap rounded-md border px-2 py-1 text-[11px]', s.id === c.id ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
              {FORMATS[s.format].label} {s.praca}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} disabled={!history.length} onClick={undo} title="Desfazer (Ctrl+Z)" />
          <Button size="sm" variant="ghost" icon={<Redo2 className="h-4 w-4" />} disabled={!redo.length} onClick={redoFn} title="Refazer" />
          {ops.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => (setOps([]), setHistory([]), setRedo([]))}>
                Descartar
              </Button>
              <Button size="sm" variant="primary" icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate()}>
                Salvar v{(d.versions[0]?.number ?? 0) + 1} ({pendingDiff.length})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* esquerda */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Camadas</div>
          <div className="min-h-0 flex-1 overflow-auto p-2">{displayed && <LayersPanel doc={displayed} selectedId={selected} onSelect={setSelected} onToggleHidden={toggleHidden} flagged={flagged} />}</div>
          <div className="border-t border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <History className="mr-1 inline h-3.5 w-3.5" /> Versões
          </div>
          <div className="max-h-64 overflow-auto p-2">
            {d.versions.map((v) => (
              <button key={v.id} onClick={() => setCompare(v)} className={clsx('mb-1 w-full rounded-md p-2 text-left text-xs hover:bg-slate-50', v.id === current?.id && 'bg-slate-50 ring-1 ring-slate-200')}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">v{v.number}</span>
                  <span className={clsx('text-[10px]', v.origin === 'ia' ? 'text-violet-600' : v.origin === 'manual' ? 'text-sky-600' : 'text-slate-400')}>{ORIGIN_LABEL[v.origin]}</span>
                </div>
                {v.instruction && <div className="truncate text-slate-500">“{v.instruction}”</div>}
                <div className="text-[10px] text-slate-400">
                  {NAMES[v.authorId] ?? v.authorId} · {fmtDateTime(v.createdAt)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* centro */}
        <section className="relative min-w-0 flex-1">
          {displayed && <Canvas doc={displayed} ctx={ctx} selectedId={selected} onSelect={setSelected} onCommit={commitGeometry} highlightIds={[...flagged]} readOnly={readOnly} safeArea={spec.safe} showSafe={showSafe} />}
          <div className="absolute left-3 top-3 flex flex-col gap-2">
            <div className="rounded-lg bg-white/95 px-3 py-2 shadow">
              <Toggle checked={showSafe} onChange={setShowSafe} label={<span className="text-xs">Área segura</span>} />
            </div>
            {proposal?.previewDoc && (
              <div className="rounded-lg bg-violet-600 px-3 py-2 text-white shadow">
                <Toggle checked={showPreview} onChange={setShowPreview} label={<span className="text-xs">{showPreview ? 'Mostrando prévia da IA' : 'Mostrando versão atual'}</span>} />
              </div>
            )}
            {readOnly && !proposal && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">
                <Lock className="h-3.5 w-3.5" /> Somente leitura para seu perfil
              </div>
            )}
          </div>
        </section>

        {/* direita */}
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="grid grid-cols-4 border-b border-slate-200 text-xs">
            {(
              [
                ['props', 'Editar', <SlidersHorizontal key="a" className="h-4 w-4" />],
                ['copiloto', 'Copiloto', <Bot key="b" className="h-4 w-4" />],
                ['regras', 'Regras', <ShieldCheck key="c" className="h-4 w-4" />],
                ['revisao', 'Revisão', <MessageSquare key="d" className="h-4 w-4" />],
              ] as const
            ).map(([t, label, icon]) => (
              <button key={t} onClick={() => setTab(t)} className={clsx('relative flex flex-col items-center gap-0.5 py-2', tab === t ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800')}>
                {icon}
                {label}
                {t === 'regras' && report && (report.counts.critico > 0 || report.counts.alerta > 0) && <span className={clsx('absolute right-5 top-1.5 h-2 w-2 rounded-full', report.counts.critico ? 'bg-red-500' : 'bg-amber-500')} />}
                {tab === t && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-600" />}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'props' && <PropertiesPanel layer={sel} ctx={ctx} push={pushOp} readOnly={readOnly} />}
            {tab === 'regras' && (
              <ValidationPanel
                report={report}
                onSelectLayer={setSelected}
                title={proposal && showPreview ? 'Prévia das regras sobre a proposta da IA' : ops.length ? 'Prévia local (confirmada no servidor ao salvar)' : `Última validação no servidor · v${current?.number}`}
              />
            )}
            {tab === 'regras' && d && (
              <div className="px-4 pb-4">
                <SemanticReview campaignId={d.creative.campaignId} creativeId={d.creative.id} refKey={current?.id} compact />
              </div>
            )}
            {tab === 'copiloto' && (
              <div className="space-y-4 p-4">
                <div className="rounded-lg bg-violet-50 p-3 text-xs text-violet-900">
                  Peça em português. A IA devolve um <strong>patch estruturado</strong>; o servidor descarta qualquer campo protegido (preço, vigência, advertência, produto) e você confirma antes de virar versão.
                </div>
                {ops.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Salve ou descarte as edições manuais antes de pedir à IA.</div>}
                <div>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Ex.: reduza o título, aumente o produto e dê mais espaço ao CTA"
                    value={instruction}
                    disabled={!can(user, 'criador') || ops.length > 0 || !!proposal}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && instruction.trim().length > 2) ask.mutate({ text: instruction, scope });
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <select className="input w-auto py-1 text-xs" value={scope} onChange={(e) => setScope(e.target.value as 'piece' | 'siblings')}>
                      <option value="piece">Só esta peça</option>
                      <option value="siblings">Esta peça em todas as praças</option>
                    </select>
                    <Button size="sm" variant="ai" icon={<Send className="h-3.5 w-3.5" />} loading={ask.isPending} disabled={instruction.trim().length < 3 || ops.length > 0 || !!proposal || !can(user, 'criador')} onClick={() => ask.mutate({ text: instruction, scope })}>
                      Pedir
                    </Button>
                  </div>
                </div>
                {!proposal && (
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => setInstruction(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-violet-300 hover:bg-violet-50">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {lastAsk && <ProposalCard p={lastAsk} before={current?.doc} ctx={ctx} onApply={() => apply.mutate()} onDiscard={() => (proposal ? discard.mutate() : setLastAsk(null))} applying={apply.isPending} />}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico desta peça</div>
                  <AuditList compact events={d.audit.filter((e) => e.type.startsWith('ai.') || e.type.includes('protected') || e.type === 'version.created').slice(0, 12)} />
                </div>
              </div>
            )}
            {tab === 'revisao' && <ReviewTab d={d} onSuggest={(t) => (setInstruction(t), setTab('copiloto'))} refresh={refresh} />}
          </div>
        </aside>
      </div>

      <CompareModal v={compare} current={current} ctx={ctx} onClose={() => setCompare(null)} onRestore={async (v) => {
        try {
          const r = await api.restore(id, v.id);
          setCompare(null);
          refresh();
          toast(`v${v.number} restaurada como v${r.version.number} (precisa de nova aprovação).`);
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      }} canRestore={can(user, 'criador')} />
    </div>
  );
}

function DiffList({ diff }: { diff: DiffEntry[] }) {
  if (!diff.length) return <div className="text-xs text-slate-500">Sem diferenças.</div>;
  const fmt = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? `“${v.length > 40 ? v.slice(0, 40) + '…' : v}”` : String(v));
  return (
    <ul className="space-y-1 text-xs">
      {diff.map((x, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="font-medium text-slate-700">{x.role === 'documento' ? 'Peça' : ROLE_LABELS[x.role]}</span>
          <span className="text-slate-400">{x.field}</span>
          <span className="text-slate-500 line-through">{fmt(x.from)}</span>→<span className="text-slate-800">{fmt(x.to)}</span>
        </li>
      ))}
    </ul>
  );
}

function ProposalCard({ p, before, ctx, onApply, onDiscard, applying }: { p: Proposal; before?: VersionDTO['doc']; ctx: ReturnType<typeof ctxFor>; onApply: () => void; onDiscard: () => void; applying: boolean }) {
  const refused = p.status === 'recusada';
  return (
    <div className={clsx('rounded-xl border p-3', refused ? 'border-red-200 bg-red-50/50' : 'border-violet-200 bg-white')}>
      <div className="mb-2 flex items-center justify-between">
        <span className={clsx('text-xs font-semibold', refused ? 'text-red-700' : 'text-violet-700')}>{refused ? 'Pedido recusado' : 'Proposta da IA'}</span>
        <AiBadge provider={p.provider} fallback={p.fallback} />
      </div>
      {p.fallback && p.error && (
        <div className="mb-2 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900">
          <span className="font-semibold">A IA real falhou e o modo demonstração respondeu. Motivo:</span> {p.error}
        </div>
      )}
      {refused ? (
        <p className="text-xs text-red-800">{p.refusal?.message}</p>
      ) : (
        <>
          <p className="text-xs text-slate-700">{p.summary}</p>
          {before && p.previewDoc && (
            <div className="my-3 grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="mb-1 text-[10px] uppercase text-slate-400">Antes</div>
                <div className="flex justify-center rounded bg-slate-100 p-1.5">
                  <Thumb doc={before} ctx={ctx} maxW={140} maxH={160} />
                </div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-[10px] uppercase text-violet-500">Depois</div>
                <div className="flex justify-center rounded bg-violet-50 p-1.5">
                  <Thumb doc={p.previewDoc} ctx={ctx} maxW={140} maxH={160} />
                </div>
              </div>
            </div>
          )}
          <DiffList diff={p.diff} />
          {p.rejected.length > 0 && (
            <div className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-800">
              <div className="font-semibold">Descartado pelo servidor:</div>
              {p.rejected.map((r, i) => (
                <div key={i}>• {r.reason}</div>
              ))}
            </div>
          )}
          {p.validation && (
            <div className="mt-2 text-[11px] text-slate-500">
              Regras na prévia: {p.validation.counts.critico} crítico · {p.validation.counts.alerta} alerta
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" className="flex-1" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={applying} onClick={onApply}>
              Aplicar como nova versão
            </Button>
            <Button size="sm" onClick={onDiscard} icon={<X className="h-3.5 w-3.5" />}>
              Descartar
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Ao aplicar, a nova versão não herda aprovação: vai para a fila de exceções.</p>
        </>
      )}
      {refused && (
        <button onClick={onDiscard} className="mt-2 text-[11px] text-slate-500 hover:underline">
          fechar
        </button>
      )}
    </div>
  );
}

function ReviewTab({ d, onSuggest, refresh }: { d: CreativeDetail; onSuggest: (t: string) => void; refresh: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const c = d.creative;
  const v = c.current!;
  const [comment, setComment] = useState('');
  const [learn, setLearn] = useState(true);
  const [critique, setCritique] = useState<CritiqueDTO | null>(d.critique ? ({ id: d.critique.id, provider: d.critique.provider, ...d.critique.data } as CritiqueDTO) : null);
  const crit = useMutation({ mutationFn: () => api.critique(c.id), onSuccess: (r) => setCritique(r), onError: (e) => toast((e as Error).message, 'error') });
  const decide = useMutation({
    mutationFn: (decision: 'aprovado' | 'ajustes') => api.reviewCreative(c.id, v.id, decision, comment || undefined, learn),
    onSuccess: (r) => {
      setComment('');
      refresh();
      toast(r.status === 'aprovado' ? `v${v.number} aprovada.` : 'Ajustes solicitados ao criador.', r.status === 'aprovado' ? 'ok' : 'warn');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const explain: Record<string, string> = {
    bloqueado: 'Há erro crítico nas regras. A peça não pode ser aprovada nem exportada até ser corrigida (no conteúdo ou na fonte de dados).',
    aguardando_conceito: 'Peça derivada do template. Será liberada automaticamente quando o conceito for aprovado, se não houver alertas.',
    aguardando_revisao: 'Exceção: esta versão precisa de decisão individual de um revisor.',
    ajustes_solicitados: 'O revisor pediu ajustes. Uma nova versão volta para a fila.',
    aprovado: 'Esta versão foi aprovada individualmente por um revisor.',
    aprovado_por_heranca: 'Liberada por herança: derivada do conceito aprovado e sem alertas nas regras.',
    rascunho: 'Rascunho.',
  };
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-1 flex items-center justify-between">
          <StatusBadge status={c.status} />
          <span className="text-[11px] text-slate-400">v{v.number}</span>
        </div>
        <p className="text-xs text-slate-600">{explain[c.status]}</p>
        {c.exceptionReason && <p className="mt-1 text-xs font-medium text-slate-700">Motivo: {c.exceptionReason}</p>}
        <Button
          size="sm"
          className="mt-3 w-full"
          icon={<Download className="h-3.5 w-3.5" />}
          disabled={c.status !== 'aprovado' && c.status !== 'aprovado_por_heranca'}
          onClick={() => api.downloadPng(c.id).catch((e) => toast(e.message, 'error'))}
        >
          Baixar PNG {c.status !== 'aprovado' && c.status !== 'aprovado_por_heranca' ? '(liberado após aprovação)' : ''}
        </Button>
      </div>

      {can(user, 'revisor') && (c.status === 'aguardando_revisao' || c.status === 'ajustes_solicitados') && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <div className="text-sm font-semibold">Sua decisão sobre a v{v.number}</div>
          {v.instruction && <div className="text-xs text-slate-600">Pedido que gerou esta versão: “{v.instruction}”</div>}
          <textarea className="input" rows={2} placeholder="Comentário (obrigatório para pedir ajustes)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Toggle checked={learn} onChange={setLearn} label={<span className="text-xs">Sugerir como aprendizado da marca</span>} />
          <div className="flex gap-2">
            <Button size="sm" variant="success" className="flex-1" icon={<ThumbsUp className="h-3.5 w-3.5" />} loading={decide.isPending && decide.variables === 'aprovado'} onClick={() => decide.mutate('aprovado')}>
              Aprovar
            </Button>
            <Button size="sm" variant="danger" className="flex-1" icon={<Wrench className="h-3.5 w-3.5" />} loading={decide.isPending && decide.variables === 'ajustes'} onClick={() => decide.mutate('ajustes')}>
              Pedir ajustes
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-violet-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ScanEye className="h-4 w-4 text-violet-600" /> Revisor de marca (IA)
          </div>
          {critique && <AiBadge provider={critique.provider} fallback={critique.fallback} />}
        </div>
        <p className="text-[11px] text-slate-500">Analisa a imagem renderizada: hierarquia, legibilidade, respiro e tom. É consultivo; não bloqueia nem aprova.</p>
        <Button size="sm" variant="ai" className="mt-2 w-full" icon={<Sparkles className="h-3.5 w-3.5" />} loading={crit.isPending} onClick={() => crit.mutate()}>
          {critique ? 'Analisar de novo' : 'Analisar peça'}
        </Button>
        {critique?.fallback && critique.error && <div className="mt-2 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900">A IA real falhou: {critique.error}</div>}
        {critique && (
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center gap-3">
              <div className={clsx('font-display text-3xl font-semibold', critique.score >= 80 ? 'text-emerald-600' : critique.score >= 60 ? 'text-amber-600' : 'text-red-600')}>{critique.score}</div>
              <div className="text-slate-600">{critique.summary}</div>
            </div>
            {critique.strengths.map((s, i) => (
              <div key={i} className="flex gap-1.5 text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s}
              </div>
            ))}
            {critique.issues.map((s, i) => (
              <div key={i} className={clsx('flex gap-1.5', s.severity === 'alta' ? 'text-red-700' : 'text-amber-800')}>
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s.text}
              </div>
            ))}
            {critique.suggestions.map((s, i) => (
              <button key={i} onClick={() => onSuggest(s.instruction)} className="flex w-full items-center justify-between rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-left text-violet-800 hover:bg-violet-100">
                {s.text} <span className="text-[10px]">usar no copiloto →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Decisões registradas</div>
        {d.reviews.length === 0 ? (
          <div className="text-xs text-slate-500">Nenhuma decisão individual (peças derivadas herdam a aprovação do conceito).</div>
        ) : (
          d.reviews.map((r) => (
            <div key={r.id} className="mb-2 rounded-md bg-slate-50 p-2 text-xs">
              <div className="flex justify-between">
                <Badge tone={r.decision === 'aprovado' ? 'emerald' : 'amber'}>{r.decision}</Badge>
                <span className="text-slate-400">
                  {NAMES[r.reviewerId] ?? r.reviewerId} · {fmtDateTime(r.createdAt)} · v{d.versions.find((x) => x.id === r.versionId)?.number}
                </span>
              </div>
              {r.comment && <div className="mt-1 text-slate-700">{r.comment}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CompareModal({ v, current, ctx, onClose, onRestore, canRestore }: { v: VersionDTO | null; current: VersionDTO | null; ctx: ReturnType<typeof ctxFor>; onClose: () => void; onRestore: (v: VersionDTO) => void; canRestore: boolean }) {
  if (!v || !current) return null;
  const diff = diffDocs(v.doc, current.doc);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <GitCompare className="h-4 w-4" /> v{v.number} × versão atual (v{current.number})
        </span>
      }
      footer={
        canRestore && v.id !== current.id ? (
          <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => onRestore(v)}>
            Restaurar v{v.number} como nova versão
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_1fr_280px]">
        {[v, current].map((x) => (
          <div key={x.id} className="text-center">
            <div className="mb-2 text-xs text-slate-500">
              v{x.number} · {ORIGIN_LABEL[x.origin]} · <StatusBadge status={x.status} />
            </div>
            <div className="flex justify-center rounded-lg bg-slate-100 p-3">
              <Thumb doc={x.doc} ctx={ctx} maxW={380} maxH={420} />
            </div>
            {x.instruction && <div className="mt-2 text-xs text-slate-500">“{x.instruction}”</div>}
          </div>
        ))}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Diferenças</div>
          <DiffList diff={diff} />
          {v.rejected.length > 0 && (
            <div className="mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-800">
              <div className="font-semibold">Operações recusadas nesta versão:</div>
              {v.rejected.map((r, i) => (
                <div key={i}>• {r.reason}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
