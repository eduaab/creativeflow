import { CATEGORY_LABELS, FORMATS, FORMAT_IDS, addDays, formatBRL, type Briefing, type FormatId } from '@cf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Check, CircleDashed, Loader2, OctagonX, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PreviewResult } from '../api/client';
import { PageShell } from '../components/Layout';
import { Badge, Button, ErrorBox, Loading, Modal, PageHeader, Toggle } from '../components/ui';
import { useToast } from '../lib/toast';

const FORMAT_ICON: Record<FormatId, string> = { feed: '1:1', retrato: '4:5', stories: '9:16', banner: '16:5', encarte: 'A4' };

export function NewCampaignPage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.offers() });
  const status = useQuery({ queryKey: ['status'], queryFn: api.status });
  const today = status.data?.today ?? new Date().toISOString().slice(0, 10);
  const [b, setB] = useState<Briefing | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [step, setStep] = useState<null | 'criando' | 'conceito' | 'pecas'>(null);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (b || !status.data) return;
    setB({
      name: 'Semana do Autocuidado',
      objective: 'Aumentar a lembrança de itens de cuidado pessoal na rotina e levar o cliente ao app',
      tone: 'claro e acolhedor',
      startsAt: addDays(today, 1),
      endsAt: addDays(today, 7),
      pracas: ['PE', 'BA'],
      formats: ['feed', 'stories', 'banner', 'encarte'],
      segments: ['geral'],
      skus: ['SKU-1001', 'SKU-1005', 'SKU-1007'],
      ctaLabel: 'Compre no app',
      ctaUrl: 'https://exemplo.com.br/ofertas',
      restrictions: 'Não alterar nome, preço, vigência ou imagem do produto.',
      layoutFamily: 'auto',
    });
  }, [status.data, b, today]);

  useEffect(() => {
    if (!b) return;
    const t = setTimeout(() => {
      api
        .preview(b)
        .then((p) => {
          setPreview(p);
          setErr(null);
        })
        .catch((e) => {
          setPreview(null);
          setErr((e as Error).message);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [b]);

  const offerIndex = useMemo(() => {
    const m = new Map<string, NonNullable<typeof offers.data>[number]>();
    for (const o of offers.data ?? []) m.set(`${o.sku}|${o.praca}`, o);
    return m;
  }, [offers.data]);

  if (catalog.isLoading || !b) return <Loading />;
  if (catalog.error) return <ErrorBox error={catalog.error} />;
  const { products, pracas, segments } = catalog.data!;
  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => setB({ ...b, [k]: v });
  const toggle = <K extends 'pracas' | 'formats' | 'segments' | 'skus'>(k: K, v: string) => {
    const arr = b[k] as string[];
    set(k, (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]) as Briefing[K]);
  };
  const criticals = preview?.issues.filter((i) => i.severity === 'critico') ?? [];

  async function submit() {
    if (!b) return;
    try {
      setStep('criando');
      const c = await api.createCampaign(b);
      setStep('conceito');
      const k = await api.generateConcept(c.id);
      if (k.ai.fallback) toast('Provedor de IA indisponível; conceito gerado em modo demonstração.', 'warn');
      setStep('pecas');
      const g = await api.generatePieces(c.id);
      qc.invalidateQueries();
      toast(`${g.total} peças geradas em ${(g.ms / 1000).toFixed(1)}s a partir de um único conceito.`);
      nav(`/campanhas/${c.id}?tab=conceito`);
    } catch (e) {
      toast((e as Error).message, 'error');
      setStep(null);
    }
  }

  return (
    <PageShell wide>
      <PageHeader eyebrow="Etapa 1 · Briefing" title="Nova campanha" subtitle="Campos comerciais vêm do catálogo e do cadastro de ofertas. A IA só escreve o texto criativo." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Campanha</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={b.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="label">Tom de comunicação</label>
                <input className="input" value={b.tone} onChange={(e) => set('tone', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Objetivo</label>
                <textarea className="input" rows={2} value={b.objective} onChange={(e) => set('objective', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início</label>
                  <input type="date" className="input" value={b.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
                </div>
                <div>
                  <label className="label">Fim</label>
                  <input type="date" className="input" value={b.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Texto do CTA</label>
                  <input className="input" maxLength={24} value={b.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} />
                </div>
                <div>
                  <label className="label">Layout</label>
                  <select className="input" value={b.layoutFamily} onChange={(e) => set('layoutFamily', e.target.value as Briefing['layoutFamily'])}>
                    <option value="auto">IA escolhe</option>
                    <option value="classico">Clássico (texto + produto)</option>
                    <option value="destaque">Destaque do produto</option>
                    <option value="faixa">Faixa de cor (título no topo)</option>
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">Restrições</label>
                <input className="input" value={b.restrictions} onChange={(e) => set('restrictions', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Distribuição</h2>
            <div>
              <label className="label">Praças</label>
              <div className="flex flex-wrap gap-2">
                {pracas.map((p) => (
                  <Chip key={p.code} on={b.pracas.includes(p.code)} onClick={() => toggle('pracas', p.code)}>
                    {p.code} · {p.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Públicos</label>
              {(() => {
                const singles = b.formats.filter((f) => !FORMATS[f].multiProduct).length;
                const multis = b.formats.length - singles;
                const perSegment = b.pracas.length * (singles * b.skus.length + multis);
                const club = segments.find((s) => s.id === 'fidelidade');
                const clubOn = b.segments.includes('fidelidade');
                return (
                  <>
                    {club && (
                      <div className={clsx('mb-3 flex items-start justify-between gap-4 rounded-lg border p-3', clubOn ? 'border-amber-300 bg-amber-50' : 'border-slate-200')}>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            Versão para o Clube de fidelidade
                            {club.badge && <span className="rounded-full bg-[#FFC93C] px-2 py-0.5 text-[11px] font-semibold text-slate-900">{club.badge}</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {clubOn
                              ? `Ligado: além do público geral, gera um conjunto de peças com selo e texto para quem é do programa (+${perSegment} peças).`
                              : `Desligado: a campanha fala só com o público geral. Ligue para gerar também a versão do Clube (+${perSegment} peças).`}
                          </p>
                        </div>
                        <Toggle checked={clubOn} onChange={() => toggle('segments', 'fidelidade')} label={<span className="text-xs font-medium">{clubOn ? 'Incluir' : 'Não incluir'}</span>} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {segments
                        .filter((s) => s.id !== 'fidelidade')
                        .map((s) => (
                          <Chip key={s.id} on={b.segments.includes(s.id)} onClick={() => toggle('segments', s.id)} title={s.description}>
                            {s.name}
                          </Chip>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">Cada público selecionado gera um conjunto completo de peças ({perSegment} por público), com textos adaptados pela IA.</p>
                  </>
                );
              })()}
            </div>
            <div>
              <label className="label">Formatos e canais</label>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {FORMAT_IDS.map((f) => {
                  const spec = FORMATS[f];
                  const on = b.formats.includes(f);
                  return (
                    <button key={f} onClick={() => toggle('formats', f)} className={clsx('rounded-lg border p-3 text-left transition', on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{spec.label}</span>
                        {on && <Check className="h-4 w-4 text-brand-600" />}
                      </div>
                      <div className="text-xs text-slate-500">{spec.channel}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {spec.width}×{spec.height} · {FORMAT_ICON[f]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Produtos e ofertas autorizadas</h2>
              <span className="text-xs text-slate-500">Preço e vigência por praça vêm do cadastro (travados)</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {products.map((p) => {
                const on = b.skus.includes(p.sku);
                return (
                  <button key={p.sku} onClick={() => toggle('skus', p.sku)} className={clsx('rounded-lg border p-3 text-left transition', on ? 'border-brand-600 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.sku} · {CATEGORY_LABELS[p.category]}
                        </div>
                      </div>
                      <div className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>{on && <Check className="h-3.5 w-3.5" />}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(p.category === 'rx' || p.category === 'mip') && <Badge tone={p.category === 'rx' ? 'red' : 'amber'}>{p.category === 'rx' ? 'prescrição' : 'MIP'}</Badge>}
                      {b.pracas.map((pr) => {
                        const o = offerIndex.get(`${p.sku}|${pr}`);
                        const valid = o && o.status === 'ativa' && o.endsAt >= today;
                        return (
                          <span key={pr} className={clsx('rounded px-1.5 py-0.5 text-[11px]', !o ? 'bg-red-50 text-red-700' : valid ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700')}>
                            {pr}: {!o ? 'sem oferta' : valid ? formatBRL(o.priceCents) : 'vencida'}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-700 to-brand-600 p-5 text-white">
              <div className="text-xs uppercase tracking-wider text-brand-100">Escala desta campanha</div>
              <div className="mt-1 font-display text-5xl font-semibold">{preview?.totalPieces ?? '–'}</div>
              <div className="text-sm text-brand-100">peças a partir de um único conceito</div>
              {preview && (
                <div className="mt-3 rounded-lg bg-white/10 p-2 text-xs leading-relaxed">
                  {preview.breakdown.pracas} praça(s) × {preview.breakdown.segments} público(s) × ({preview.breakdown.singleFormats} formato(s) × {preview.breakdown.products} produto(s)
                  {preview.breakdown.multiFormats ? ` + ${preview.breakdown.multiFormats} encarte` : ''})
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validações antes de gerar</div>
              {err && <div className="text-sm text-red-600">{err}</div>}
              {preview && preview.issues.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" /> Todas as ofertas encontradas e vigentes.
                </div>
              )}
              {preview?.issues.map((i, idx) => (
                <div key={idx} className={clsx('flex gap-2 rounded-md p-2 text-xs', i.severity === 'critico' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>
                  {i.severity === 'critico' ? <OctagonX className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  {i.message}
                </div>
              ))}
              {criticals.length > 0 && <p className="text-[11px] text-slate-500">Você pode gerar mesmo assim: as peças afetadas nascem bloqueadas e nenhum preço alternativo é preenchido.</p>}
            </div>
            <div className="border-t border-slate-200 p-4">
              <Button variant="ai" className="w-full" icon={<Sparkles className="h-4 w-4" />} disabled={!preview} onClick={submit}>
                Gerar conceito e peças
              </Button>
            </div>
          </div>
        </aside>
      </div>
      <Modal open={!!step} onClose={() => {}} title="Gerando campanha">
        <div className="space-y-3">
          {[
            ['criando', 'Salvando briefing e validando ofertas'],
            ['conceito', 'IA escrevendo o conceito por público'],
            ['pecas', `Derivando ${preview?.totalPieces ?? ''} peças pelos templates da marca e rodando as regras`],
          ].map(([id, text], i) => {
            const order = ['criando', 'conceito', 'pecas'];
            const cur = order.indexOf(step ?? '');
            const state = i < cur ? 'done' : i === cur ? 'doing' : 'todo';
            return (
              <div key={id} className="flex items-center gap-3 text-sm">
                {state === 'done' ? <Check className="h-5 w-5 text-emerald-600" /> : state === 'doing' ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> : <CircleDashed className="h-5 w-5 text-slate-300" />}
                <span className={state === 'todo' ? 'text-slate-400' : ''}>{text}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
            <Wand2 className="h-4 w-4" /> A IA escreve; templates e regras determinísticas montam e verificam cada peça.
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}

function Chip({ on, children, onClick, title }: { on: boolean; children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button title={title} onClick={onClick} className={clsx('chip', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400')}>
      {on && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
