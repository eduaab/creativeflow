import { FORMATS, LAYOUT_FAMILIES, BACKGROUND_STYLES, STATUS_LABELS, type Concept, type CreativeStatus } from '@cf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Download, FileArchive, History, LineChart, Lightbulb, RefreshCw, Save, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, type CampaignDetail, type CreativeDTO, type Metrics } from '../api/client';
import { AuditList } from '../components/AuditList';
import { ChannelTexts } from '../components/ChannelTexts';
import { SemanticReview } from '../components/SemanticReview';
import { PageShell } from '../components/Layout';
import { Thumb } from '../components/Thumb';
import { Badge, Button, Empty, ErrorBox, Loading, Modal, PageHeader, Stat, StatusBadge, Tabs, Toggle } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { ctxFor } from '../lib/ctx';
import { fmtDate, fmtDateTime } from '../lib/format';
import { useToast } from '../lib/toast';
import { StatusBar } from './Campaigns';

type Tab = 'pecas' | 'conceito' | 'metricas' | 'historico' | 'exportacoes';

export function CampaignPage() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'pecas';
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaign(id) });
  const [exportOpen, setExportOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const revalidate = useMutation({
    mutationFn: () => api.revalidate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      toast('Regras reexecutadas com os dados comerciais atuais.');
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const b = d.campaign.briefing;
  const byStatus: Partial<Record<CreativeStatus, number>> = {};
  for (const c of d.creatives) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  const approved = (byStatus.aprovado ?? 0) + (byStatus.aprovado_por_heranca ?? 0);

  const steps = [
    { label: 'Briefing', done: true },
    { label: 'Conceito', done: d.concept?.status === 'aprovado' },
    { label: 'Peças', done: d.creatives.length > 0 },
    { label: 'Aprovação', done: d.creatives.length > 0 && approved === d.creatives.length },
    { label: 'Exportação', done: !!d.campaign.firstExportAt },
  ];

  return (
    <PageShell wide>
      <PageHeader
        eyebrow={<Link to="/campanhas" className="hover:underline">Campanhas</Link>}
        title={d.campaign.name}
        subtitle={`${fmtDate(b.startsAt)} – ${fmtDate(b.endsAt)} · ${b.pracas.join(', ')} · ${b.objective}`}
        actions={
          <>
            <Button icon={<RefreshCw className="h-4 w-4" />} loading={revalidate.isPending} onClick={() => revalidate.mutate()}>
              Revalidar regras
            </Button>
            <Button variant="primary" icon={<Download className="h-4 w-4" />} disabled={!approved} onClick={() => setExportOpen(true)}>
              Exportar aprovadas ({approved})
            </Button>
          </>
        }
      />
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-4">
        <div className="flex flex-1 items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', s.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')}>{s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</div>
              <span className={clsx('text-sm', s.done ? 'font-medium text-slate-800' : 'text-slate-500')}>{s.label}</span>
              {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-slate-300" />}
            </div>
          ))}
        </div>
        <div className="w-72">
          <StatusBar byStatus={byStatus} total={d.creatives.length} />
          <div className="mt-1 text-right text-xs text-slate-500">
            {approved}/{d.creatives.length} liberadas
          </div>
        </div>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setSp({ tab: t })}
        tabs={[
          { id: 'pecas', label: <>Peças <Badge>{d.creatives.length}</Badge></> },
          { id: 'conceito', label: <>Conceito {d.concept?.status === 'proposto' && <Badge tone="violet">aguardando</Badge>}</> },
          { id: 'metricas', label: <><LineChart className="h-4 w-4" /> Ganho e métricas</> },
          { id: 'historico', label: <><History className="h-4 w-4" /> Trilha de auditoria</> },
          { id: 'exportacoes', label: <><FileArchive className="h-4 w-4" /> Exportações</> },
        ]}
      />
      <div className="mt-5">
        {tab === 'pecas' && <PiecesTab d={d} />}
        {tab === 'conceito' && <ConceptTab d={d} />}
        {tab === 'metricas' && <MetricsTab id={id} />}
        {tab === 'historico' && <HistoryTab id={id} />}
        {tab === 'exportacoes' && <ExportsTab d={d} />}
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} d={d} />
    </PageShell>
  );
}

/* ------------------------------ Peças ----------------------------- */
const STATUS_ORDER: CreativeStatus[] = ['bloqueado', 'aguardando_revisao', 'ajustes_solicitados', 'aguardando_conceito', 'aprovado', 'aprovado_por_heranca', 'rascunho'];

function PiecesTab({ d }: { d: CampaignDetail }) {
  const [praca, setPraca] = useState('');
  const [format, setFormat] = useState('');
  const [segment, setSegment] = useState('');
  const [status, setStatus] = useState<CreativeStatus | ''>('');
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const segName = (sid: string) => catalog.data?.segments.find((s) => s.id === sid)?.name ?? sid;
  const list = d.creatives
    .filter((c) => (!praca || c.praca === praca) && (!format || c.format === format) && (!segment || c.segmentId === segment) && (!status || c.status === status))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  if (!d.creatives.length)
    return <Empty icon={<Sparkles className="h-8 w-8" />} title="Nenhuma peça ainda" text="Gere o conceito e depois as peças na aba Conceito." />;
  const counts: Partial<Record<CreativeStatus, number>> = {};
  for (const c of d.creatives) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={praca} onChange={(e) => setPraca(e.target.value)}>
          <option value="">Todas as praças</option>
          {d.campaign.briefing.pracas.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Todos os formatos</option>
          {d.campaign.briefing.formats.map((f) => (
            <option key={f} value={f}>
              {FORMATS[f].label}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option value="">Todos os públicos</option>
          {d.campaign.briefing.segments.map((s) => (
            <option key={s} value={s}>
              {segName(s)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
            <button key={s} onClick={() => setStatus(status === s ? '' : s)} className={clsx('rounded-full', status && status !== s && 'opacity-40')}>
              <StatusBadge status={s} className="cursor-pointer" />
              <span className="sr-only">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 text-xs text-slate-500">
        Mostrando {list.length} de {d.creatives.length} peças · {STATUS_ORDER.filter((s) => counts[s]).map((s) => `${STATUS_LABELS[s]}: ${counts[s]}`).join(' · ')}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {list.map((c) => (
          <PieceCard key={c.id} c={c} d={d} segName={segName(c.segmentId)} />
        ))}
      </div>
    </div>
  );
}

function PieceCard({ c, d, segName }: { c: CreativeDTO; d: CampaignDetail; segName: string }) {
  const ctx = useMemo(() => ctxFor(d.context, c.praca, c.skus), [d.context, c.praca, c.skus]);
  if (!c.current) return null;
  const failed = c.current.validation?.results.filter((r) => !r.passed && r.severity !== 'info').map((r) => r.layerId).filter(Boolean) as string[];
  const product = c.skus.length > 1 ? `${c.skus.length} produtos` : d.context.products[c.skus[0]]?.name;
  return (
    <Link to={`/pecas/${c.id}`} className="card group flex flex-col overflow-hidden transition hover:border-brand-600 hover:shadow-md">
      <div className="checker flex h-[220px] items-center justify-center bg-slate-100 p-3">
        <Thumb doc={c.current.doc} ctx={ctx} maxW={190} maxH={196} highlightIds={c.status === 'bloqueado' ? failed : undefined} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800">
            {FORMATS[c.format].label} · {c.praca}
          </span>
          <span className="text-[11px] text-slate-400">v{c.current.number}</span>
        </div>
        <div className="truncate text-xs text-slate-500" title={product}>
          {product}
        </div>
        <div className="truncate text-[11px] text-slate-400">{segName}</div>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <StatusBadge status={c.status} />
        </div>
        {c.exceptionReason && <div className="text-[11px] text-slate-500">{c.exceptionReason}</div>}
      </div>
    </Link>
  );
}

/* ----------------------------- Conceito --------------------------- */
function ConceptTab({ d }: { d: CampaignDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const concept = d.concept;
  const [draft, setDraft] = useState<Concept | null>(concept?.data ?? null);
  const [feedback, setFeedback] = useState('');
  const [comment, setComment] = useState('');
  const [learn, setLearn] = useState(true);
  useEffect(() => setDraft(concept?.data ?? null), [concept?.id]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['campaign', d.campaign.id] });
    qc.invalidateQueries({ queryKey: ['queue'] });
    qc.invalidateQueries({ queryKey: ['campaigns'] });
  };
  const regen = useMutation({
    mutationFn: async () => {
      const k = await api.generateConcept(d.campaign.id, feedback || undefined);
      const g = await api.generatePieces(d.campaign.id);
      return { k, g };
    },
    onSuccess: ({ k, g }) => {
      refresh();
      setFeedback('');
      toast(`Novo conceito gerado${k.ai.examples ? ` (com ${k.ai.examples} conceito(s) aprovado(s) como referência)` : ''}. ${g.updated + g.created} peça(s) derivadas atualizadas; ${g.kept} editada(s) preservada(s).`);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const save = useMutation({
    mutationFn: async () => {
      await api.editConcept(d.campaign.id, draft!);
      return api.generatePieces(d.campaign.id);
    },
    onSuccess: (g) => {
      refresh();
      toast(`Conceito salvo como nova versão e propagado para ${g.updated + g.created} peça(s).`);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const gen = useMutation({ mutationFn: () => api.generatePieces(d.campaign.id), onSuccess: (g) => (refresh(), toast(`${g.total} peças verificadas (${g.created} novas).`)) });
  const review = useMutation({
    mutationFn: (decision: 'aprovado' | 'reprovado') => api.reviewConcept(concept!.id, decision, comment || undefined, learn),
    onSuccess: (r, decision) => {
      refresh();
      setComment('');
      toast(decision === 'aprovado' ? `Conceito aprovado: ${r.statusCounts.aprovado_por_heranca ?? 0} peça(s) liberadas por herança.` : 'Conceito reprovado. O criador pode pedir nova proposta.', decision === 'aprovado' ? 'ok' : 'warn');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  if (!concept || !draft)
    return (
      <Empty
        icon={<Sparkles className="h-8 w-8" />}
        title="Sem conceito"
        action={can(user, 'criador') && <Button variant="ai" loading={regen.isPending} onClick={() => regen.mutate()}>Gerar conceito com IA</Button>}
      />
    );
  const dirty = JSON.stringify(draft) !== JSON.stringify(concept.data);
  const editable = can(user, 'criador');
  const segName = (sid: string) => catalog.data?.segments.find((s) => s.id === sid)?.name ?? sid;
  const sample = (sid: string) => d.creatives.find((c) => c.segmentId === sid && c.format === 'feed') ?? d.creatives.find((c) => c.segmentId === sid);
  const setVar = (i: number, k: keyof Concept['variants'][number], v: string | null) => setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  Conceito #{concept.number}: {draft.theme}
                </h2>
                <Badge tone={concept.status === 'aprovado' ? 'emerald' : concept.status === 'reprovado' ? 'red' : 'violet'}>{concept.status}</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{draft.rationale}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <Badge tone={concept.source.startsWith('mock') ? 'amber' : 'violet'}><Sparkles className="h-3 w-3" /> {concept.source.includes('contingência') ? 'IA real falhou: modo demonstração (contingência)' : concept.source.startsWith('mock') ? 'IA em modo demonstração' : concept.source === 'manual' ? 'editado manualmente' : `IA: ${concept.source}`}</Badge>
                <span>criado {fmtDateTime(concept.createdAt)}</span>
                {concept.approvedAt && <span>· aprovado {fmtDateTime(concept.approvedAt)}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <div>
                <label className="label">Layout</label>
                <select className="input w-auto" disabled={!editable} value={draft.layoutFamily} onChange={(e) => setDraft({ ...draft, layoutFamily: e.target.value as Concept['layoutFamily'] })}>
                  {LAYOUT_FAMILIES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Fundo</label>
                <select className="input w-auto" disabled={!editable} value={draft.backgroundStyle} onChange={(e) => setDraft({ ...draft, backgroundStyle: e.target.value as Concept['backgroundStyle'] })}>
                  {BACKGROUND_STYLES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Título do encarte</label>
            <input className="input" disabled={!editable} value={draft.encarteHeadline} onChange={(e) => setDraft({ ...draft, encarteHeadline: e.target.value })} />
          </div>
        </div>

        {draft.variants.map((v, i) => {
          const s = sample(v.segmentId);
          return (
            <div key={v.segmentId} className="card grid gap-4 p-5 md:grid-cols-[1fr_200px]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone="brand">Público</Badge>
                  <span className="font-semibold">{segName(v.segmentId)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Título</label>
                    <input className="input" disabled={!editable} value={v.headline} onChange={(e) => setVar(i, 'headline', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Título curto (Stories/banner)</label>
                    <input className="input" disabled={!editable} value={v.shortHeadline} onChange={(e) => setVar(i, 'shortHeadline', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">CTA</label>
                      <input className="input" disabled={!editable} value={v.cta} onChange={(e) => setVar(i, 'cta', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Selo</label>
                      <input className="input" disabled={!editable} value={v.badge ?? ''} placeholder="sem selo" onChange={(e) => setVar(i, 'badge', e.target.value || null)} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Subtítulo</label>
                    <textarea className="input" rows={2} disabled={!editable} value={v.subheadline} onChange={(e) => setVar(i, 'subheadline', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-lg bg-slate-100 p-2">
                {s?.current ? <Thumb doc={s.current.doc} ctx={ctxFor(d.context, s.praca, s.skus)} maxW={180} maxH={220} /> : <span className="text-xs text-slate-400">gere as peças</span>}
              </div>
              <ChannelTexts variant={v} d={d} editable={editable} onChange={(m) => setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, messages: m } : x)) })} />
            </div>
          );
        })}
      </div>

      <aside className="space-y-4">
        {editable && (
          <div className="card space-y-3 p-4">
            <div className="text-sm font-semibold">Criação</div>
            <Button variant="primary" className="w-full" icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              Salvar e propagar para as peças
            </Button>
            <p className="text-[11px] text-slate-500">Cria o conceito #{concept.number + 1}. Peças derivadas são regeneradas; peças editadas à mão ou pela IA são preservadas e vão para revisão.</p>
            <div className="border-t border-slate-100 pt-3">
              <label className="label">Pedir nova proposta à IA</label>
              <textarea className="input" rows={2} placeholder="Ex.: mais acolhedor, foco em praticidade" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <Button variant="ai" className="mt-2 w-full" icon={<Wand2 className="h-4 w-4" />} loading={regen.isPending} onClick={() => regen.mutate()}>
                Nova proposta
              </Button>
            </div>
            {d.creatives.length === 0 && (
              <Button className="w-full" loading={gen.isPending} onClick={() => gen.mutate()}>
                Gerar peças
              </Button>
            )}
          </div>
        )}
        <SemanticReview campaignId={d.campaign.id} refKey={concept.id} />
        <div className={clsx('card space-y-3 p-4', concept.status === 'proposto' && 'border-violet-300 ring-2 ring-violet-100')}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> Aprovação do conceito
          </div>
          <p className="text-xs text-slate-600">
            Aprovar o conceito libera <strong>por herança</strong> todas as peças derivadas que passarem nas regras sem alerta. Só exceções (edições e alertas) vão para revisão individual.
          </p>
          {concept.status === 'proposto' && can(user, 'revisor') ? (
            <>
              <textarea className="input" rows={2} placeholder="Comentário (obrigatório para reprovar)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Toggle checked={learn} onChange={setLearn} label={<span className="text-xs">Transformar o motivo em aprendizado da marca</span>} />
              <div className="flex gap-2">
                <Button variant="success" className="flex-1" icon={<ThumbsUp className="h-4 w-4" />} loading={review.isPending && review.variables === 'aprovado'} onClick={() => review.mutate('aprovado')}>
                  Aprovar
                </Button>
                <Button variant="danger" className="flex-1" icon={<ThumbsDown className="h-4 w-4" />} loading={review.isPending && review.variables === 'reprovado'} onClick={() => review.mutate('reprovado')}>
                  Reprovar
                </Button>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">{concept.status === 'aprovado' ? 'Conceito aprovado.' : concept.status === 'proposto' ? 'Aguardando um revisor.' : 'Conceito reprovado — peça nova proposta.'}</div>
          )}
        </div>
        <div className="card p-4">
          <div className="mb-2 text-sm font-semibold">Histórico de conceitos</div>
          <div className="space-y-1.5">
            {d.concepts.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs">
                <span>
                  #{c.number} · {c.data.theme}
                </span>
                <span className="text-slate-500">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------- Métricas --------------------------- */
function MetricsTab({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['metrics', id], queryFn: () => api.metrics(id) });
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [minutes, setMinutes] = useState<string>('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (q.data) {
      setMinutes(q.data.gain.baselineMinutesPerPiece ? String(q.data.gain.baselineMinutesPerPiece) : '');
      setNote(q.data.gain.baselineNote ?? '');
    }
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const m: Metrics = q.data!;
  const g = m.governance;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peças da campanha" value={m.pieces.total} hint={Object.entries(m.pieces.byFormat).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        <Stat label="Decisões humanas" value={m.effort.humanDecisions} hint={m.effort.piecesPerHumanDecision ? `${m.effort.piecesPerHumanDecision.toFixed(1)} peças por decisão` : 'nenhuma ainda'} />
        <Stat label="Aprovadas por herança" value={`${Math.round(m.pieces.inheritedRate * 100)}%`} hint={`${m.pieces.inherited} de ${m.pieces.approved} liberadas`} tone="emerald" />
        <Stat label="Tempo de geração" value={`${m.effort.generationSeconds}s`} hint="soma das gerações em lote (medido)" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">Estimativa de ganho</h3>
          <p className="mt-1 text-xs text-slate-500">Compare com o processo atual: cronometre uma pessoa produzindo adaptações manualmente (mesmos formatos e critérios) e informe o tempo médio por peça. O tempo da plataforma é medido do briefing à primeira exportação.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Processo manual (projeção)</div>
              <div className="font-display text-2xl font-semibold">{m.gain.manualProjectionMinutes ? `${Math.round(m.gain.manualProjectionMinutes)} min` : '—'}</div>
              <div className="text-[11px] text-slate-500">{m.gain.baselineMinutesPerPiece ? `${m.pieces.total} peças × ${m.gain.baselineMinutesPerPiece} min` : 'informe o tempo medido'}</div>
            </div>
            <div className="rounded-lg bg-brand-50 p-4">
              <div className="text-xs text-brand-700">Com a plataforma (medido)</div>
              <div className="font-display text-2xl font-semibold text-brand-700">{m.gain.measuredMinutes !== null ? `${m.gain.measuredMinutes} min` : '—'}</div>
              <div className="text-[11px] text-brand-700">{m.gain.measuredMinutes !== null ? 'briefing → primeira exportação' : 'exporte para medir'}</div>
            </div>
          </div>
          {m.gain.multiplier && <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800">≈ {m.gain.multiplier}× mais rápido neste caso de teste</div>}
          {can(user, 'admin') ? (
            <div className="mt-4 grid grid-cols-[120px_1fr_auto] items-end gap-2">
              <div>
                <label className="label">Min / peça</label>
                <input className="input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="medido" />
              </div>
              <div>
                <label className="label">Como foi medido</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: 6 adaptações no editor atual, média de 3 pessoas" />
              </div>
              <Button
                onClick={async () => {
                  await api.updateSettings({ baseline: { minutesPerPiece: minutes ? Number(minutes) : null, note } });
                  qc.invalidateQueries({ queryKey: ['metrics', id] });
                  toast('Tempo de referência salvo.');
                }}
              >
                Salvar
              </Button>
            </div>
          ) : (
            m.gain.baselineNote && <p className="mt-3 text-xs text-slate-500">Referência: {m.gain.baselineNote}</p>
          )}
          <p className="mt-3 text-[11px] text-slate-400">Números só são apresentados como resultado depois de medidos. Considere curva de aprendizado, correções e custo de API.</p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Governança em números</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {[
              ['Pedidos à IA aplicados', g.aiEditsApplied],
              ['Pedidos à IA recusados', g.aiEditsRefused],
              ['Tentativas em campo protegido bloqueadas', g.protectedFieldBlocks],
              ['Edições manuais', g.manualEdits],
              ['Ajustes pedidos pelo revisor', g.adjustmentsRequested],
              ['Retidas no gate de exportação', g.blockedAtExport],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border border-slate-200 p-3">
                <div className="font-display text-xl font-semibold">{v}</div>
                <div className="text-xs text-slate-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1">
            {(Object.entries(m.pieces.byStatus) as [CreativeStatus, number][]).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between text-xs">
                <StatusBadge status={s} />
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['audit', id], queryFn: () => api.audit(id) });
  if (q.isLoading) return <Loading />;
  return (
    <div className="card p-5">
      <p className="mb-4 text-xs text-slate-500">Quem criou, quem alterou, o que a IA propôs, o que foi recusado, quem aprovou e o que foi exportado. Registro imutável.</p>
      <AuditList events={q.data ?? []} />
    </div>
  );
}

function ExportsTab({ d }: { d: CampaignDetail }) {
  const toast = useToast();
  if (!d.exports.length) return <Empty icon={<FileArchive className="h-8 w-8" />} title="Nenhuma exportação" text="Somente versões aprovadas e revalidadas no momento da exportação entram no pacote." />;
  return (
    <div className="card divide-y divide-slate-100">
      {d.exports.map((e) => (
        <div key={e.id} className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">{e.fileName}</div>
            <div className="text-xs text-slate-500">
              {fmtDateTime(e.createdAt)} · {e.count} arquivo(s) {e.blocked ? `· ${e.blocked} retida(s) pelo gate` : ''} · com manifest.json e relatorio.csv
            </div>
          </div>
          <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => api.downloadExport(e.id).catch((err) => toast(err.message, 'error'))}>
            Baixar ZIP
          </Button>
        </div>
      ))}
    </div>
  );
}

function ExportModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: CampaignDetail }) {
  const [pracas, setPracas] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const qc = useQueryClient();
  const toast = useToast();
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.exportCampaign>> | null>(null);
  const [error, setError] = useState<{ message: string; blocked?: { file: string; reason: string; status: string }[] } | null>(null);
  const run = useMutation({
    mutationFn: () => api.exportCampaign(d.campaign.id, { pracas: pracas.length ? pracas : undefined, formats: formats.length ? formats : undefined }),
    onSuccess: async (r) => {
      setResult(r);
      setError(null);
      qc.invalidateQueries({ queryKey: ['campaign', d.campaign.id] });
      await api.downloadExport(r.exportId).catch((e) => toast(e.message, 'error'));
    },
    onError: (e) => setError({ message: (e as Error).message, blocked: (e as { details?: { blocked?: { file: string; reason: string; status: string }[] } }).details?.blocked }),
  });
  const pick = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setResult(null);
        setError(null);
      }}
      title="Exportar peças aprovadas"
      footer={
        <Button variant="primary" icon={<Download className="h-4 w-4" />} loading={run.isPending} onClick={() => run.mutate()}>
          Revalidar e exportar
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">Cada peça é revalidada agora, com os dados comerciais atuais. Oferta vencida ou versão não aprovada fica fora do pacote. O ZIP inclui manifest.json (versão, aprovador, oferta usada) e relatorio.csv.</p>
        <div>
          <label className="label">Praças (vazio = todas)</label>
          <div className="flex flex-wrap gap-2">
            {d.campaign.briefing.pracas.map((p) => (
              <button key={p} onClick={() => pick(pracas, setPracas, p)} className={clsx('chip', pracas.includes(p) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Formatos (vazio = todos)</label>
          <div className="flex flex-wrap gap-2">
            {d.campaign.briefing.formats.map((f) => (
              <button key={f} onClick={() => pick(formats, setFormats, f)} className={clsx('chip', formats.includes(f) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                {FORMATS[f].label}
              </button>
            ))}
          </div>
        </div>
        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="font-medium text-emerald-800">{result.count} arquivo(s) exportado(s) — download iniciado.</div>
            {result.blocked.length > 0 && (
              <div className="mt-2 text-xs text-slate-700">
                <div className="font-medium">{result.blocked.length} retida(s) pelo gate:</div>
                <ul className="mt-1 max-h-40 list-disc overflow-auto pl-4">
                  {result.blocked.map((b) => (
                    <li key={b.file}>
                      {b.file.split('/').pop()} — {b.status}: {b.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="font-medium">{error.message}</div>
            {error.blocked && <div className="mt-1">{error.blocked.length} peça(s) retida(s).</div>}
          </div>
        )}
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> Na integração real, o pacote vai para o destino configurado (DAM, SharePoint, pasta da agência) pela interface PublishTarget.
        </div>
      </div>
    </Modal>
  );
}
