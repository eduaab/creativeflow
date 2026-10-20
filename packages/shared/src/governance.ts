import type { CreativeStatus, VersionOrigin } from './domain';
import type { ValidationReport } from './rules';

/**
 * APROVAÇÃO POR CONCEITO + EXCEÇÃO
 *
 * - O revisor aprova o conceito-mestre (textos por público + família de layout).
 * - Peças DERIVADAS deterministicamente desse conceito (outro formato, outra praça,
 *   preço puxado da oferta validada) herdam a aprovação SE passarem em todas as regras
 *   sem alertas.
 * - Qualquer edição humana ou por IA, ou qualquer alerta, manda a peça para a fila de
 *   exceções: aprovação individual daquela versão.
 * - Nenhuma versão herda a aprovação de outra versão da mesma peça.
 * - Erro crítico sempre bloqueia, independentemente de aprovação.
 */
export interface StatusInput {
  origin: VersionOrigin;
  validation: ValidationReport;
  /** Conceito usado na versão está aprovado? */
  conceptApproved: boolean;
  /** Decisão humana registrada para ESTA versão (se houver). */
  decisionForVersion?: 'aprovado' | 'ajustes' | null;
}

export function deriveStatus(i: StatusInput): CreativeStatus {
  if (!i.validation.passed) return 'bloqueado';
  if (i.decisionForVersion === 'ajustes') return 'ajustes_solicitados';
  if (i.decisionForVersion === 'aprovado') return 'aprovado';
  if (i.origin === 'derivada') {
    if (!i.conceptApproved) return 'aguardando_conceito';
    if (i.validation.counts.alerta === 0) return 'aprovado_por_heranca';
  }
  return 'aguardando_revisao';
}

export function exceptionReason(i: StatusInput): string | null {
  if (!i.validation.passed) return 'Bloqueio crítico';
  if (i.origin === 'manual') return 'Edição manual';
  if (i.origin === 'ia') return 'Edição por IA';
  if (i.validation.counts.alerta > 0) return `${i.validation.counts.alerta} alerta(s) nas regras`;
  return null;
}

export function canExport(status: CreativeStatus, validation: ValidationReport): { ok: boolean; reason?: string } {
  if (!validation.passed) return { ok: false, reason: 'A revalidação encontrou erro crítico.' };
  if (status !== 'aprovado' && status !== 'aprovado_por_heranca') return { ok: false, reason: 'Somente versões aprovadas podem ser exportadas.' };
  return { ok: true };
}
