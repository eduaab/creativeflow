import { CATEGORY_LABELS, formatBRL, formatDateBR } from '@cf/shared';
import { productImageSrc } from '@cf/shared/render';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, type ImportReport } from '../api/client';
import { PageShell } from '../components/Layout';
import { Badge, Button, ErrorBox, Loading, PageHeader, Tabs } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export function CatalogPage() {
  const { user } = useAuth();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.offers() });
  const status = useQuery({ queryKey: ['status'], queryFn: api.status });
  const [tab, setTab] = useState<'ofertas' | 'produtos'>('ofertas');
  const [praca, setPraca] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const today = status.data?.today ?? '';

  const dry = useMutation({ mutationFn: (f: File) => api.importOffers(f, true), onSuccess: setReport, onError: (e) => toast((e as Error).message, 'error') });
  const commit = useMutation({
    mutationFn: (f: File) => api.importOffers(f, false),
    onSuccess: (r) => {
      setReport(null);
      setFile(null);
      qc.invalidateQueries();
      toast(`${r.valid} oferta(s) importada(s). ${r.reevaluated ?? 0} peça(s) revalidadas com os novos dados.`);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  if (catalog.isLoading || offers.isLoading) return <Loading />;
  if (catalog.error) return <ErrorBox error={catalog.error} />;
  const products = Object.fromEntries(catalog.data!.products.map((p) => [p.sku, p]));
  const list = (offers.data ?? []).filter((o) => !praca || o.praca === praca);

  return (
    <PageShell wide>
      <PageHeader
        title="Catálogo e ofertas"
        subtitle="Fonte única dos dados comerciais. A IA nunca escreve preço: as peças leem daqui e são revalidadas quando algo muda."
        actions={
          <Button icon={<Download className="h-4 w-4" />} onClick={() => api.downloadOffers().catch((e) => toast(e.message, 'error'))}>
            Baixar planilha atual
          </Button>
        }
      />
      {can(user, 'admin') && (
        <div className="card mb-6 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            <div className="min-w-[260px] flex-1">
              <div className="font-semibold">Importar planilha de ofertas (CSV ou XLSX)</div>
              <div className="text-xs text-slate-500">Colunas: sku, praca, preco, preco_de, inicio, fim, condicoes, status. Substitui a oferta vigente do SKU na praça. É assim que o fluxo atual entra sem reestruturação.</div>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  dry.mutate(f);
                }
                e.target.value = '';
              }}
            />
            <Button icon={<Upload className="h-4 w-4" />} loading={dry.isPending} onClick={() => input.current?.click()}>
              Escolher arquivo
            </Button>
          </div>
          {report && file && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <strong>{file.name}</strong>: {report.total} linha(s), <span className="text-emerald-700">{report.valid} válida(s)</span>
                  {report.errors.length > 0 && <span className="text-red-700">, {report.errors.length} com erro</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => (setReport(null), setFile(null))}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="primary" disabled={!report.valid} loading={commit.isPending} onClick={() => commit.mutate(file)}>
                    Confirmar importação
                  </Button>
                </div>
              </div>
              {report.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-red-700">
                  {report.errors.map((e) => (
                    <li key={e.line}>
                      Linha {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'ofertas', label: `Ofertas (${offers.data?.length ?? 0})` },
          { id: 'produtos', label: `Produtos (${catalog.data!.products.length})` },
        ]}
      />
      <div className="mt-4">
        {tab === 'ofertas' ? (
          <>
            <div className="mb-3 flex gap-2">
              {['', ...catalog.data!.pracas.map((p) => p.code)].map((p) => (
                <button key={p || 'todas'} onClick={() => setPraca(p)} className={clsx('chip', praca === p ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white')}>
                  {p || 'Todas'}
                </button>
              ))}
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Oferta</th>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2">Praça</th>
                    <th className="px-4 py-2 text-right">Preço</th>
                    <th className="px-4 py-2">Vigência</th>
                    <th className="px-4 py-2">Situação</th>
                    <th className="px-4 py-2">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((o) => {
                    const valid = o.status === 'ativa' && o.startsAt <= today && o.endsAt >= today;
                    return (
                      <tr key={o.id}>
                        <td className="px-4 py-2 font-mono text-xs">{o.id}</td>
                        <td className="px-4 py-2">{products[o.sku]?.name ?? o.sku}</td>
                        <td className="px-4 py-2">{o.praca}</td>
                        <td className="px-4 py-2 text-right">
                          {o.listPriceCents && <span className="mr-2 text-xs text-slate-400 line-through">{formatBRL(o.listPriceCents)}</span>}
                          <span className="font-semibold">{formatBRL(o.priceCents)}</span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {formatDateBR(o.startsAt)} a {formatDateBR(o.endsAt)}
                        </td>
                        <td className="px-4 py-2">{valid ? <Badge tone="emerald">vigente</Badge> : <Badge tone="red">{o.status === 'inativa' ? 'inativa' : 'fora da vigência'}</Badge>}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{o.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">Sem linha para um SKU na praça = peça bloqueada (COM-001). O protetor solar não tem oferta no CE e o condicionador está vencido na BA — de propósito, para demonstrar os bloqueios.</p>
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalog.data!.products.map((p) => (
              <div key={p.sku} className="card flex gap-4 p-4">
                <img src={productImageSrc(p)} alt="" className="h-24 w-20 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.sku} · {p.brand}
                  </div>
                  <div className="mt-1">
                    <Badge tone={p.category === 'rx' ? 'red' : p.category === 'mip' ? 'amber' : 'slate'}>{CATEGORY_LABELS[p.category]}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-medium">Alegações autorizadas:</span> {p.claims.length ? p.claims.join('; ') : 'nenhuma'}
                  </div>
                  {p.image.type === 'none' && <div className="mt-1 text-xs text-amber-700">Sem imagem autorizada (placeholder)</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
