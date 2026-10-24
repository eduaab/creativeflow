import type { AuditEvent } from '../api/client';

const LABELS: Record<string, string> = {
  'campaign.created': 'Campanha criada a partir do briefing',
  'concept.generated': 'Conceito gerado',
  'concept.edited': 'Conceito editado manualmente',
  'concept.aprovado': 'Conceito aprovado',
  'concept.reprovado': 'Conceito reprovado',
  'pieces.generated': 'Peças geradas pelos templates',
  'version.created': 'Nova versão salva',
  'ai.edit.proposed': 'IA propôs alteração',
  'ai.edit.applied': 'Alteração da IA aplicada',
  'ai.edit.discarded': 'Alteração da IA descartada',
  'ai.edit.refused': 'Pedido à IA recusado',
  'edit.protected_field_blocked': 'Tentativa de alterar campo protegido bloqueada',
  'review.aprovado': 'Peça aprovada pelo revisor',
  'review.ajustes': 'Revisor pediu ajustes',
  'rules.revalidated': 'Regras reexecutadas',
  'export.done': 'Exportação gerada',
  'export.blocked': 'Exportação bloqueada',
  'export.single': 'Download unitário',
  'notification.sent': 'Notificação enviada',
  'ai.critique': 'Revisor de marca (IA) analisou a peça',
  'offers.imported': 'Planilha de ofertas importada',
  'settings.updated': 'Configurações alteradas',
  'rules.updated': 'Regras alteradas',
};

export function auditLabel(e: AuditEvent): string {
  return LABELS[e.type] ?? e.type;
}

export function auditDetail(e: AuditEvent): string {
  const p = e.payload;
  switch (e.type) {
    case 'concept.generated':
      return `#${p.number} · ${p.provider}${p.fallback ? ' (contingência)' : ''} · ${p.ms} ms${p.feedback ? ` · feedback: "${p.feedback}"` : ''}${p.error ? ` · ERRO DA IA: ${p.error}` : ''}`;
    case 'pieces.generated':
      return `${p.total} peças (${p.created} novas, ${p.updated} regeradas, ${p.kept} mantidas) em ${(Number(p.ms) / 1000).toFixed(1)} s`;
    case 'version.created':
      return `v${p.number} · ${p.origin}${p.instruction ? ` · "${p.instruction}"` : ''} · ${p.changes} alteração(ões) · ${p.critical ? `${p.critical} crítico(s)` : 'sem crítico'}${p.approvalReset ? ' · aprovação anterior não herdada' : ''}`;
    case 'ai.edit.refused':
      return `"${p.instruction}" → ${(p.refusal as { message?: string })?.message ?? ''} (${p.by})${p.aiError ? ` · ERRO DA IA: ${p.aiError}` : ''}`;
    case 'ai.edit.proposed':
    case 'ai.edit.applied':
      return `"${p.instruction}"`;
    case 'edit.protected_field_blocked':
      return `${p.source === 'ia' ? 'Pela IA' : 'No editor'}: ${(p.rejected as { reason: string }[]).map((r) => r.reason).join(' ')}`;
    case 'review.ajustes':
    case 'concept.reprovado':
      return String(p.comment ?? '');
    case 'concept.aprovado':
      return `#${p.number}`;
    case 'export.done':
      return `${p.count} arquivo(s) · ${p.blocked} retida(s) pelo gate`;
    case 'notification.sent':
      return `${p.title} (${p.delivered === 'teams' ? 'Teams' : 'registro'})`;
    case 'ai.critique':
      return `nota ${p.score} · ${p.provider}`;
    default:
      return '';
  }
}

export function auditTone(type: string): 'red' | 'amber' | 'emerald' | 'violet' | 'slate' {
  if (type.includes('blocked') || type.includes('refused') || type.includes('reprovado')) return 'red';
  if (type.includes('ajustes')) return 'amber';
  if (type.includes('aprovado') || type === 'export.done') return 'emerald';
  if (type.startsWith('ai.') || type.startsWith('concept.generated')) return 'violet';
  return 'slate';
}
