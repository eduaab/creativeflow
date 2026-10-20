import { FORMATS, diffDocs } from '@cf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Inbox, ShieldCheck, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import { Thumb } from '../components/Thumb';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, StatusBadge } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { ctxFor } from '../lib/ctx';
import { ORIGIN_LABEL } from '../lib/format';
import { useToast } from '../lib/toast';

export function ApprovalsPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['queue'], queryFn: api.queue });
  const qc = useQueryClient();
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const isReviewer = can(user, 'revisor');
  const refresh = () => qc.invalidateQueries();
  const concept = useMutation({
    mutationFn: (id: string) => api.reviewConcept(id, 'aprovado'),
    onSuccess: (r) => (refresh(), toast(`Conceito aprovado: ${r.statusCounts.aprovado_por_heranca ?? 0} peça(s) liberadas por herança.`)),
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const batch = useMutation({
    mutationFn: (ids: string[]) => api.batchApprove(ids),
    onSuccess: (r) => {
      setSel([]);
      refresh();
      const fail = r.filter((x) => !x.ok);
      toast(`${r.length - fail.length} aprovada(s).${fail.length ? ` ${fail.length} não puderam ser aprovadas: ${fail[0].error}` : ''}`, fail.length ? 'warn' : 'ok');
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { concepts, items, contexts } = q.data!;

  return (
    <PageShell wide>
      <PageHeader
        title="Aprovações"
        subtitle="O revisor aprova ideias, não arquivos: conceitos liberam as peças derivadas; aqui ficam só as exceções."
        actions={
          isReviewer &&
          items.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setSel(sel.length === items.length ? [] : items.map((i) => i.creative.id))}>
                {sel.length === items.length ? 'Limpar seleção' : 'Selecionar todas'}
              </Button>
              <Button variant="success" icon={<CheckCheck className="h-4 w-4" />} disabled={!sel.length} loading={batch.isPending} onClick={() => batch.mutate(sel)}>
                Aprovar selecionadas ({sel.length})
              </Button>
            </>
          )
        }
      />
      {!isReviewer && <div className="mb-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">Você está vendo a fila em modo leitura. Decisões são feitas por quem tem perfil de revisão.</div>}

      {concepts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-violet-600" /> Conceitos aguardando aprovação
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {concepts.map((c) => (
              <div key={c.id} className="card border-violet-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">{c.campaignName}</div>
                    <div className="font-semibold">
                      Conceito #{c.number}: {c.data.theme}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">“{c.data.variants[0]?.headline}”</div>
                    <div className="mt-2 text-xs text-violet-700">Aprovar libera até {c.pending} peça(s) derivada(s) de uma vez.</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {isReviewer && (
                      <Button size="sm" variant="success" icon={<ThumbsUp className="h-3.5 w-3.5" />} loading={concept.isPending} onClick={() => concept.mutate(c.id)}>
                        Aprovar
                      </Button>
                    )}
                    <Link to={`/campanhas/${c.campaignId}?tab=conceito`}>
                      <Button size="sm" className="w-full">
                        Revisar
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-3 font-semibold">Fila de exceções {items.length > 0 && <Badge tone="amber">{items.length}</Badge>}</h2>
      {items.length === 0 ? (
        <Empty icon={<Inbox className="h-8 w-8" />} title="Nenhuma exceção pendente" text="Peças derivadas e sem alerta são liberadas pela aprovação do conceito. Edições manuais, edições por IA e peças com alerta aparecem aqui." />
      ) : (
        <div className="space-y-3">
          {items.map(({ creative: c, campaign, baseVersion }) => {
            const ctx = ctxFor(contexts[c.campaignId], c.praca, c.skus);
            const v = c.current!;
            const diff = baseVersion ? diffDocs(baseVersion.doc, v.doc) : [];
            const alerts = v.validation?.results.filter((r) => !r.passed && r.severity !== 'info') ?? [];
            return (
              <div key={c.id} className="card flex flex-wrap items-center gap-5 p-4">
                {isReviewer && <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={sel.includes(c.id)} onChange={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />}
                <div className="flex gap-3">
                  {baseVersion && (
                    <div className="text-center">
                      <div className="mb-1 text-[10px] uppercase text-slate-400">Original v{baseVersion.number}</div>
                      <Thumb doc={baseVersion.doc} ctx={ctx} maxW={130} maxH={150} />
                    </div>
                  )}
                  <div className="text-center">
                    <div className="mb-1 text-[10px] uppercase text-amber-600">Para decidir v{v.number}</div>
                    <Thumb doc={v.doc} ctx={ctx} maxW={130} maxH={150} />
                  </div>
                </div>
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <div className="text-xs text-slate-500">{campaign?.name}</div>
                  <div className="font-semibold">
                    {FORMATS[c.format].label} · {c.praca} · {contexts[c.campaignId].products[c.skus[0]]?.name}
                    {c.skus.length > 1 ? ' + outros' : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <Badge tone={v.origin === 'ia' ? 'violet' : 'slate'}>{ORIGIN_LABEL[v.origin]}</Badge>
                    {c.exceptionReason && <span className="text-xs text-slate-600">{c.exceptionReason}</span>}
                  </div>
                  {v.instruction && <div className="text-xs text-slate-600">Pedido: “{v.instruction}”</div>}
                  {diff.length > 0 && <div className="text-xs text-slate-500">{diff.length} alteração(ões): {[...new Set(diff.map((x) => x.role))].join(', ')}</div>}
                  {alerts.map((a, i) => (
                    <div key={i} className="text-xs text-amber-800">
                      ⚠ {a.ruleId}: {a.message}
                    </div>
                  ))}
                </div>
                <Link to={`/pecas/${c.id}`}>
                  <Button size="sm">Abrir no estúdio</Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
