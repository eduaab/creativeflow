import { SEMANTIC_LABELS } from '@cf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ScanSearch, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import { can, useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Badge, Button } from './ui';

/**
 * Apontamentos da revisão semântica (IA-001). A IA só endurece: cada apontamento manda
 * as peças afetadas para a fila de exceções. O revisor pode descartar um falso positivo
 * informando o motivo (fica na auditoria).
 */
export function SemanticReview({ campaignId, creativeId, compact, refKey }: { campaignId: string; creativeId?: string; compact?: boolean; refKey?: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const key = creativeId ? ['semantic', 'creative', creativeId, refKey] : ['semantic', 'concept', campaignId, refKey];
  const q = useQuery({ queryKey: key, queryFn: () => (creativeId ? api.semanticCreative(creativeId) : api.semanticConcept(campaignId)) });
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const dismiss = useMutation({
    mutationFn: (findingId: string) => api.dismissSemantic(q.data!.hash, findingId, reason, campaignId),
    onSuccess: () => {
      setDismissing(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['semantic'] });
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
      if (creativeId) qc.invalidateQueries({ queryKey: ['creative', creativeId] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast('Apontamento descartado e registrado na auditoria. Peças reavaliadas.');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const c = q.data;
  const label = (ref: string) => c?.texts.find((t) => t.ref === ref);
  const active = c?.findings.filter((f) => !c.dismissed[f.id]) ?? [];
  const gone = c?.findings.filter((f) => c.dismissed[f.id]) ?? [];
  const demo = c && (c.fallback || c.provider === 'mock');

  return (
    <div className={clsx('card space-y-3', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ScanSearch className="h-4 w-4 text-violet-600" /> Revisão semântica da IA
        </div>
        {c && (active.length ? <Badge tone="amber">{active.length} apontamento(s)</Badge> : <Badge tone="emerald">sem riscos</Badge>)}
      </div>
      <p className="text-[11px] text-slate-500">
        A IA lê os textos procurando o que regras fixas não pegam: alegação de saúde disfarçada, promessa de preço implícita, tom, estereótipo, incoerência e remédio dirigido a crianças.
        <strong> Ela só manda para revisão; nunca libera nem bloqueia.</strong>
        {creativeId && c?.source === 'conceito' && ' Esta peça usa os textos do conceito.'}
      </p>
      {q.isLoading && <div className="text-xs text-slate-400">Carregando…</div>}
      {!q.isLoading && !c && <div className="text-xs text-slate-500">Ainda não revisado. A revisão roda ao gerar o conceito e a cada edição.</div>}
      {c && demo && (
        <div className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-900">
          {c.fallback ? `A IA real falhou (${c.error ?? 'sem detalhe'}); revisão feita em modo demonstração (heurística).` : 'Modo demonstração: revisão por heurística, sem IA generativa.'}
        </div>
      )}
      {active.map((f) => (
        <div key={f.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <ShieldAlert className="h-3.5 w-3.5" /> {SEMANTIC_LABELS[f.category]}
            </div>
            <span className="text-[10px] text-slate-500">
              {label(f.ref)?.label}
              {label(f.ref)?.segmentId ? ` · ${label(f.ref)?.segmentId}` : ''}
            </span>
          </div>
          <div className="mt-1 text-slate-800">“{f.excerpt}”</div>
          <div className="mt-1 text-slate-600">{f.explanation}</div>
          {f.suggestion && <div className="mt-1 text-emerald-800">Sugestão: {f.suggestion}</div>}
          {can(user, 'revisor') &&
            (dismissing === f.id ? (
              <div className="mt-2 space-y-1.5">
                <input className="input py-1 text-xs" autoFocus placeholder="Por que não é um problema? (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-1.5">
                  <Button className="py-1 text-xs" disabled={reason.trim().length < 3} loading={dismiss.isPending} onClick={() => dismiss.mutate(f.id)}>
                    Confirmar descarte
                  </Button>
                  <button className="text-xs text-slate-500" onClick={() => setDismissing(null)}>
                    cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800" onClick={() => setDismissing(f.id)}>
                <X className="h-3 w-3" /> Descartar (falso positivo)
              </button>
            ))}
        </div>
      ))}
      {gone.length > 0 && (
        <details className="text-[11px] text-slate-500">
          <summary className="cursor-pointer">{gone.length} descartado(s) pelo revisor</summary>
          {gone.map((f) => (
            <div key={f.id} className="mt-1">
              “{f.excerpt}” — {c!.dismissed[f.id].reason}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
