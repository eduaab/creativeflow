import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Layers, PlusCircle, ShieldAlert, Sparkles, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PageShell } from '../components/Layout';
import { Button, Empty, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { CampaignRow } from './Campaigns';
import { can, useAuth } from '../lib/auth';

export function DashboardPage() {
  const { user } = useAuth();
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue });
  if (campaigns.isLoading) return <Loading />;
  if (campaigns.error) return <ErrorBox error={campaigns.error} />;
  const list = campaigns.data ?? [];
  const sum = (k: string) => list.reduce((s, c) => s + ((c.byStatus as Record<string, number>)[k] ?? 0), 0);
  const total = list.reduce((s, c) => s + c.total, 0);
  const inherited = sum('aprovado_por_heranca');
  const approved = inherited + sum('aprovado');
  const exceptions = queue.data?.items.length ?? 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Olá, ${user?.name.split(' ')[0]}`}
        title="Painel de produção criativa"
        subtitle="Visão geral de campanhas, peças e governança."
        actions={can(user, 'criador') && <Link to="/campanhas/nova"><Button variant="primary" icon={<PlusCircle className="h-4 w-4" />}>Nova campanha</Button></Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peças geradas" value={total} hint={`${list.length} campanha(s)`} />
        <Stat label="Liberadas" value={approved} hint={approved ? `${Math.round((inherited / approved) * 100)}% por herança do conceito` : 'aguardando aprovações'} tone="emerald" />
        <Stat label="Fila de exceções" value={exceptions} hint="peças editadas ou com alerta" tone={exceptions ? 'amber' : undefined} />
        <Stat label="Bloqueadas por regra" value={sum('bloqueado')} hint="erro crítico impede aprovação" tone={sum('bloqueado') ? 'red' : undefined} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Campanhas recentes</h2>
            <Link to="/campanhas" className="text-sm text-brand-600 hover:underline">Ver todas</Link>
          </div>
          {list.length === 0 ? (
            <Empty icon={<Layers className="h-8 w-8" />} title="Nenhuma campanha ainda" text="Crie um briefing e veja um único conceito virar dezenas de peças por praça, público e canal." action={can(user, 'criador') && <Link to="/campanhas/nova"><Button variant="primary">Criar a primeira campanha</Button></Link>} />
          ) : (
            <div className="space-y-3">{list.slice(0, 5).map((c) => <CampaignRow key={c.id} c={c} />)}</div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Como o fluxo funciona</h2>
          {[
            { icon: Workflow, t: 'Briefing estruturado', d: 'Produtos e ofertas vêm do cadastro. A IA não inventa preço, vigência nem alegação.' },
            { icon: Sparkles, t: 'Um conceito, muitas peças', d: 'A IA escreve o conceito por público; templates da marca derivam todos os formatos e praças.' },
            { icon: ShieldAlert, t: 'Aprovação por exceção', d: 'O revisor aprova o conceito uma vez. Só peças editadas ou com alerta vão para a fila.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="card flex gap-3 p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div>
                <div className="text-sm font-semibold">{t}</div>
                <div className="text-xs text-slate-500">{d}</div>
              </div>
            </div>
          ))}
          {exceptions > 0 && (
            <Link to="/aprovacoes" className="card flex items-center justify-between border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              {exceptions} peça(s) aguardando sua decisão <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </PageShell>
  );
}
