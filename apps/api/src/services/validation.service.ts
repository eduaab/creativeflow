import { deriveStatus, exceptionReason, validateCreative, type CreativeStatus, type RenderContext, type ValidationReport } from '@cf/shared';
import { getCampaign, getConcept, type CampaignRow } from '../models/campaign.model';
import { getCreative, getVersion, updateCreativeState, updateVersionValidation, type CreativeRow, type VersionRow } from '../models/creative.model';
import { getDecisionForVersion } from '../models/governance.model';
import { notFound } from '../utils/errors';
import { buildContext, getSegment } from './context.service';
import { getRulesConfig } from './settings.service';

export interface Evaluation {
  report: ValidationReport;
  status: CreativeStatus;
  reason: string | null;
  ctx: RenderContext;
}

/**
 * Executa as regras e recalcula o estado da peça. Sempre usa dados comerciais frescos,
 * então uma oferta que vence durante a revisão derruba a liberação automaticamente.
 */
export async function evaluateVersion(creative: CreativeRow, version: VersionRow, campaign?: CampaignRow, opts: { persist?: boolean } = {}): Promise<Evaluation> {
  const camp = campaign ?? (await getCampaign(creative.campaignId));
  if (!camp) throw notFound('Campanha');
  const [ctx, rules, segment] = await Promise.all([buildContext(version.doc, camp), getRulesConfig(), getSegment(creative.segmentId)]);
  const report = validateCreative(version.doc, ctx, { config: rules, segment });
  const concept = version.conceptId ? await getConcept(version.conceptId) : undefined;
  const decision = await getDecisionForVersion(version.id);
  const input = { origin: version.origin, validation: report, conceptApproved: concept?.status === 'aprovado', decisionForVersion: decision };
  const status = deriveStatus(input);
  let reason = status === 'aguardando_revisao' || status === 'bloqueado' || status === 'ajustes_solicitados' ? exceptionReason(input) : null;
  if (status === 'ajustes_solicitados') reason = 'Revisor pediu ajustes';
  if (concept && concept.status === 'substituido' && version.origin !== 'derivada' && status === 'aguardando_revisao') reason = `${reason ?? 'Edição'} sobre conceito anterior`;
  if (opts.persist !== false) {
    await updateVersionValidation(version.id, report, status);
    if (!creative.currentVersionId || creative.currentVersionId === version.id) await updateCreativeState(creative.id, { status, exceptionReason: reason, currentVersionId: version.id });
  }
  return { report, status, reason, ctx };
}

export async function evaluateCreativeById(creativeId: string): Promise<Evaluation & { creative: CreativeRow; version: VersionRow }> {
  const creative = await getCreative(creativeId);
  if (!creative?.currentVersionId) throw notFound('Peça');
  const version = await getVersion(creative.currentVersionId);
  if (!version) throw notFound('Versão');
  const ev = await evaluateVersion(creative, version);
  return { ...ev, creative, version };
}
