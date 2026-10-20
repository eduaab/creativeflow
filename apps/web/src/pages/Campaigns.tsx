import { STATUS_LABELS, type CreativeStatus } from '@cf/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FolderKanban, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type CampaignOverview } from '../api/client';
import { PageShell } from '../components/Layout';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { STATUS_DOT, fmtDate } from '../lib/format';

const ORDER: CreativeStatus[] = ['aprovado_por_heranca', 'aprovado', 'aguardando_revisao', 'aguardando_conceito', 'ajustes_solicitados', 'bloqueado', 'rascunho'];

export function StatusBar({ byStatus, total }: { byStatus: Partial<Record<CreativeStatus, number>>; total: number }) {
  if (!total) return <div className="h-2 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      {ORDER.map((s) => (byStatus[s] ? <div key={s} title={`${STATUS_LABELS[s]}: ${byStatus[s]}`} className={STATUS_DOT[s]} style={{ width: `${((byStatus[s] ?? 0) / total) * 100}%` }} /> : null))}
    </div>
  );
}

export function CampaignRow({ c }: { c: CampaignOverview }) {
  const b = c.briefing;
  return (
    <Link to={`/campanhas/${c.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-600 hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-slate-900">{c.name}</span>
          {c.firstExportAt && <Badge tone="emerald">exportada</Badge>}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {fmtDate(b.startsAt)} – {fmtDate(b.endsAt)} · {b.pracas.join(', ')} · {b.formats.length} formatos · {b.segments.length} público(s) · {b.skus.length} produto(s)
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex-1">
            <StatusBar byStatus={c.byStatus} total={c.total} />
          </div>
          <span className="w-20 text-right text-xs font-medium text-slate-600">{c.total} peças</span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  );
}

export function CampaignsPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  return (
    <PageShell>
      <PageHeader title="Campanhas" subtitle="Cada campanha nasce de um briefing e se multiplica em peças por praça, público e formato." actions={can(user, 'criador') && <Link to="/campanhas/nova"><Button variant="primary" icon={<PlusCircle className="h-4 w-4" />}>Nova campanha</Button></Link>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !q.data?.length ? <Empty icon={<FolderKanban className="h-8 w-8" />} title="Nenhuma campanha" /> : <div className="space-y-3">{q.data.map((c) => <CampaignRow key={c.id} c={c} />)}</div>}
      <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-500">
        {ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </PageShell>
  );
}
