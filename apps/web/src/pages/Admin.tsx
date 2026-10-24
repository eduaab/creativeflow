import { COLOR_LABELS, type ColorToken, type RulesConfig } from '@cf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Brain, CalendarClock, Check, FlaskConical, Palette, RotateCcw, Scale, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import { Badge, Button, ErrorBox, Loading, PageHeader, Tabs, Toggle } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { fmtDateTime } from '../lib/format';
import { useToast } from '../lib/toast';

type Tab = 'marca' | 'regras' | 'aprendizados' | 'demo';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('marca');
  return (
    <PageShell>
      <PageHeader title="Marca e regras" subtitle="Manual de marca sintético, motor de regras e aprendizados que alimentam a IA. Versionados e auditáveis." />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'marca', label: <><Palette className="h-4 w-4" /> Manual de marca</> },
          { id: 'regras', label: <><Scale className="h-4 w-4" /> Regras de governança</> },
          { id: 'aprendizados', label: <><Brain className="h-4 w-4" /> Aprendizados da IA</> },
          { id: 'demo', label: <><FlaskConical className="h-4 w-4" /> Demonstração</> },
        ]}
      />
      <div className="mt-5">
        {tab === 'marca' && <BrandTab />}
        {tab === 'regras' && <RulesTab />}
        {tab === 'aprendizados' && <LearningsTab />}
        {tab === 'demo' && <DemoTab />}
      </div>
    </PageShell>
  );
}

function BrandTab() {
  const q = useQuery({ queryKey: ['brand'], queryFn: api.brand });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const b = q.data!;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Tokens de cor</h3>
          <Badge>{b.version}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(b.colors).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
              <div className="h-10 w-10 rounded-md border border-slate-200" style={{ background: v }} />
              <div>
                <div className="text-sm font-medium">{COLOR_LABELS[k as ColorToken]}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  {k} · {v}
                </div>
              </div>
            </div>
          ))}
        </div>
        <h3 className="mb-2 mt-5 font-semibold">Tipografia</h3>
        <div className="space-y-2">
          <div className="text-2xl font-extrabold text-brand-700" style={{ fontFamily: "Nunito, sans-serif" }}>Nunito — títulos, preço e CTA (arredondada, como a tipografia observada no estudo)</div>
          <div className="text-base">Inter — textos, nome do produto, vigência e advertências</div>
        </div>
        <p className="mt-4 text-xs text-slate-500">O editor e a IA só aceitam estes tokens. Qualquer cor fora da paleta é recusada no servidor (MAR-002). Trocar a marca = editar packages/shared/src/brand/brand.ts.</p>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold">Tom de voz (vai como contexto em todo pedido à IA)</h3>
        <div className="mt-1 text-xs text-slate-500">{b.voice.name}</div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {b.voice.tone.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-emerald-700">Assim</div>
            {b.voice.doExamples.map((e) => (
              <div key={e} className="mb-1 rounded bg-emerald-50 px-2 py-1">
                {e}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-red-700">Assim não</div>
            {b.voice.dontExamples.map((e) => (
              <div key={e} className="mb-1 rounded bg-red-50 px-2 py-1 line-through decoration-red-300">
                {e}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <BookOpen className="h-4 w-4 shrink-0" />
          Manual sintético construído a partir de observação de materiais públicos; o critério (fonte, data, decisão) está documentado em docs/MANUAL-DE-MARCA.md.
        </div>
      </div>
    </div>
  );
}

function TagEditor({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white p-2">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
          {t}
          {!disabled && (
            <button onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`remover ${t}`}>
              <X className="h-3 w-3 text-slate-400" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          className="min-w-[140px] flex-1 text-xs outline-none"
          placeholder="adicionar e Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim().length > 1) {
              onChange([...new Set([...value, text.trim().toLowerCase()])]);
              setText('');
            }
          }}
        />
      )}
    </div>
  );
}

function RulesTab() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['rules'], queryFn: api.rules });
  const [cfg, setCfg] = useState<RulesConfig | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    if (q.data) setCfg(q.data.config);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.updateRules({ forbiddenTerms: cfg!.forbiddenTerms, claimTerms: cfg!.claimTerms, mipWarning: cfg!.mipWarning, contrastMin: cfg!.contrastMin, contrastMinLarge: cfg!.contrastMinLarge, blockRx: cfg!.blockRx, maxExclamations: cfg!.maxExclamations }),
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast(`Regras salvas (${r.version}). Use "Revalidar regras" nas campanhas para reaplicar.`);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  if (q.isLoading || !cfg) return <Loading />;
  const admin = can(user, 'admin');
  const set = <K extends keyof RulesConfig>(k: K, v: RulesConfig[K]) => setCfg({ ...cfg, [k]: v });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="card divide-y divide-slate-100">
        {q.data!.catalog.map((r) => (
          <div key={r.id} className="flex gap-3 p-3">
            <code className="w-16 shrink-0 text-xs font-semibold text-slate-500">{r.id}</code>
            <div className="flex-1">
              <div className="text-sm font-medium">{r.title}</div>
              <div className="text-xs text-slate-500">{r.description}</div>
            </div>
            <Badge tone={r.severity === 'critico' ? 'red' : r.severity === 'alerta' ? 'amber' : 'slate'}>{r.severity}</Badge>
          </div>
        ))}
      </div>
      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Parâmetros</h3>
          <Badge>{cfg.version}</Badge>
        </div>
        <div>
          <label className="label">Termos proibidos (crítico)</label>
          <TagEditor value={cfg.forbiddenTerms} onChange={(v) => set('forbiddenTerms', v)} disabled={!admin} />
        </div>
        <div>
          <label className="label">Alegações que exigem autorização (alerta)</label>
          <TagEditor value={cfg.claimTerms} onChange={(v) => set('claimTerms', v)} disabled={!admin} />
        </div>
        <div>
          <label className="label">Advertência obrigatória de MIP</label>
          <textarea className="input" rows={2} disabled={!admin} value={cfg.mipWarning} onChange={(e) => set('mipWarning', e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-500">Texto configurável. Validar com o jurídico/regulatório antes de uso real.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Contraste</label>
            <input className="input" type="number" step="0.1" disabled={!admin} value={cfg.contrastMin} onChange={(e) => set('contrastMin', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Grande</label>
            <input className="input" type="number" step="0.1" disabled={!admin} value={cfg.contrastMinLarge} onChange={(e) => set('contrastMinLarge', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Máx. “!”</label>
            <input className="input" type="number" disabled={!admin} value={cfg.maxExclamations} onChange={(e) => set('maxExclamations', Number(e.target.value))} />
          </div>
        </div>
        <Toggle checked={cfg.blockRx} onChange={(v) => admin && set('blockRx', v)} label="Bloquear medicamento sob prescrição" />
        {admin && (
          <Button variant="primary" className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
            Salvar nova versão das regras
          </Button>
        )}
      </div>
    </div>
  );
}

function LearningsTab() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['learnings'], queryFn: api.learnings });
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const decide = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'ativa' | 'descartada' }) => api.decideLearning(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['learnings'] }) });
  const add = useMutation({ mutationFn: () => api.addLearning(text), onSuccess: () => (setText(''), qc.invalidateQueries({ queryKey: ['learnings'] }), toast('Aprendizado ativo: entra no contexto dos próximos pedidos à IA.')) });
  if (q.isLoading) return <Loading />;
  const admin = can(user, 'admin');
  const groups = (['sugerida', 'ativa', 'descartada'] as const).map((s) => [s, (q.data ?? []).filter((l) => l.status === s)] as const);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {groups.map(([s, list]) => (
          <div key={s}>
            <h3 className="mb-2 text-sm font-semibold capitalize">
              {s === 'sugerida' ? 'Sugeridos por reprovações' : s === 'ativa' ? 'Ativos (enviados à IA)' : 'Descartados'} <Badge>{list.length}</Badge>
            </h3>
            {list.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">Nada aqui.</div>
            ) : (
              <div className="space-y-2">
                {list.map((l) => (
                  <div key={l.id} className="card flex items-start gap-3 p-3">
                    <div className="flex-1">
                      <div className="text-sm">{l.text}</div>
                      <div className="text-[11px] text-slate-500">
                        {l.source} · {fmtDateTime(l.createdAt)}
                      </div>
                    </div>
                    {admin && l.status !== 'ativa' && (
                      <Button size="sm" variant="success" icon={<Check className="h-3.5 w-3.5" />} onClick={() => decide.mutate({ id: l.id, status: 'ativa' })}>
                        Ativar
                      </Button>
                    )}
                    {admin && l.status !== 'descartada' && (
                      <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: l.id, status: 'descartada' })}>
                        Descartar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="card h-fit space-y-3 p-5">
        <h3 className="font-semibold">Como a IA “aprende” sem treinamento</h3>
        <p className="text-sm text-slate-600">Quando o revisor reprova ou pede ajustes com um motivo, ele pode marcar a opção de transformar o motivo em aprendizado. O administrador ativa os bons; os ativos entram no contexto de todo pedido à IA. Sem fine-tuning, com controle e rastreabilidade.</p>
        {admin && (
          <>
            <textarea className="input" rows={3} placeholder="Ex.: Evitar a palavra 'oferta' no título; preferir 'cuidado'." value={text} onChange={(e) => setText(e.target.value)} />
            <Button variant="primary" className="w-full" disabled={text.trim().length < 5} loading={add.isPending} onClick={() => add.mutate()}>
              Adicionar aprendizado
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DemoTab() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const qc = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState('');
  useEffect(() => {
    if (q.data) setDate(q.data.today);
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  const admin = can(user, 'admin');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="h-5 w-5 text-brand-600" /> Simular a data de hoje
        </h3>
        <p className="text-sm text-slate-600">Para demonstrar “a oferta vence durante a revisão”: avance a data, clique em Revalidar na campanha e veja peças aprovadas perderem a liberação. A exportação também revalida.</p>
        <div className="flex gap-2">
          <input type="date" className="input" disabled={!admin} value={date} onChange={(e) => setDate(e.target.value)} />
          <Button disabled={!admin} onClick={async () => (await api.updateSettings({ simulatedToday: date }), qc.invalidateQueries(), toast(`Data de referência: ${date}`))}>
            Aplicar
          </Button>
          <Button variant="ghost" disabled={!admin} onClick={async () => (await api.updateSettings({ simulatedToday: null }), qc.invalidateQueries(), toast('Data real restaurada.'))}>
            Usar data real
          </Button>
        </div>
      </div>
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <RotateCcw className="h-5 w-5 text-red-600" /> Reiniciar demonstração
        </h3>
        <p className="text-sm text-slate-600">Apaga campanhas, versões, aprovações e histórico e recarrega a base sintética (produtos, praças, públicos e ofertas relativas à data de hoje).</p>
        <Button
          variant="danger"
          disabled={!admin}
          onClick={async () => {
            if (!window.confirm('Apagar todas as campanhas e recarregar a base sintética?')) return;
            await api.resetDemo();
            qc.invalidateQueries();
            toast('Base sintética recarregada.');
          }}
        >
          Reiniciar base
        </Button>
      </div>
    </div>
  );
}
