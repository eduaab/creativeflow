import { FORMATS, type CreativeStatus } from '@cf/shared';
import { getCampaign, listCampaigns } from '../models/campaign.model';
import { listCreatives } from '../models/creative.model';
import { listAudit } from '../models/governance.model';
import { notFound } from '../utils/errors';
import { getBaseline } from './settings.service';

/**
 * Métricas medidas a partir da trilha de auditoria (nada é estimado aqui, exceto a
 * projeção manual, que usa o tempo cronometrado informado pela equipe).
 */
export async function campaignMetrics(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const creatives = await listCreatives(campaignId);
  const events = (await listAudit({ campaignId, limit: 5000 })).reverse();
  const baseline = await getBaseline();

  const byStatus: Partial<Record<CreativeStatus, number>> = {};
  for (const c of creatives) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  const byFormat: Record<string, number> = {};
  for (const c of creatives) byFormat[FORMATS[c.format].label] = (byFormat[FORMATS[c.format].label] ?? 0) + 1;

  const count = (type: string) => events.filter((e) => e.type === type).length;
  const gen = events.filter((e) => e.type === 'pieces.generated');
  const generationMs = gen.reduce((s, e) => s + Number(e.payload.ms ?? 0), 0);
  const humanReviews = events.filter((e) => e.type === 'review.aprovado' || e.type === 'review.ajustes').length;
  const conceptReviews = events.filter((e) => e.type.startsWith('concept.aprovado') || e.type.startsWith('concept.reprovado')).length;
  const inherited = byStatus.aprovado_por_heranca ?? 0;
  const approved = inherited + (byStatus.aprovado ?? 0);
  const firstExport = events.find((e) => e.type === 'export.done');
  const start = new Date(campaign.createdAt).getTime();
  const elapsedMin = firstExport ? (new Date(firstExport.createdAt).getTime() - start) / 60000 : null;

  const total = creatives.length;
  const manualMinutes = baseline.minutesPerPiece ? baseline.minutesPerPiece * total : null;
  return {
    campaign: { id: campaign.id, name: campaign.name, createdAt: campaign.createdAt, firstExportAt: campaign.firstExportAt },
    pieces: { total, byStatus, byFormat, approved, inherited, inheritedRate: approved ? inherited / approved : 0 },
    effort: {
      humanDecisions: humanReviews + conceptReviews,
      piecesPerHumanDecision: humanReviews + conceptReviews ? total / (humanReviews + conceptReviews) : null,
      generationSeconds: Math.round(generationMs / 100) / 10,
      briefingToFirstExportMinutes: elapsedMin !== null ? Math.round(elapsedMin * 10) / 10 : null,
    },
    governance: {
      aiEditsProposed: count('ai.edit.proposed'),
      aiEditsApplied: count('ai.edit.applied'),
      aiEditsRefused: count('ai.edit.refused'),
      protectedFieldBlocks: count('edit.protected_field_blocked'),
      manualEdits: events.filter((e) => e.type === 'version.created' && e.payload.origin === 'manual').length,
      blockedAtExport: events.filter((e) => e.type === 'export.done').reduce((s, e) => s + Number(e.payload.blocked ?? 0), 0),
      adjustmentsRequested: count('review.ajustes'),
    },
    gain: {
      baselineMinutesPerPiece: baseline.minutesPerPiece,
      baselineNote: baseline.note,
      manualProjectionMinutes: manualMinutes,
      measuredMinutes: elapsedMin !== null ? Math.round(elapsedMin * 10) / 10 : null,
      multiplier: manualMinutes && elapsedMin ? Math.round((manualMinutes / Math.max(elapsedMin, 0.1)) * 10) / 10 : null,
    },
  };
}

export async function overview() {
  const campaigns = await listCampaigns();
  const rows = [];
  for (const c of campaigns) {
    const creatives = await listCreatives(c.id);
    const byStatus: Partial<Record<CreativeStatus, number>> = {};
    for (const x of creatives) byStatus[x.status] = (byStatus[x.status] ?? 0) + 1;
    rows.push({ id: c.id, name: c.name, createdAt: c.createdAt, updatedAt: c.updatedAt, firstExportAt: c.firstExportAt, briefing: c.briefing, total: creatives.length, byStatus });
  }
  return rows;
}
