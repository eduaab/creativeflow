import type { CreativeStatus } from '@cf/shared';
import { z } from 'zod';
import { getCampaign, getConcept, getCurrentConcept, listCampaigns, setConceptStatus, type ConceptRow } from '../models/campaign.model';
import { getCurrentVersions, getVersion, listCreatives, listCreativesByStatus, listVersions } from '../models/creative.model';
import { audit, insertLearning, insertReview } from '../models/governance.model';
import { badRequest, conflict, notFound } from '../utils/errors';
import { messageIssues } from './messages.service';
import { evaluateCreativeById, evaluateVersion } from './validation.service';

export async function reevaluateCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  const creatives = await listCreatives(campaignId);
  const versions = await getCurrentVersions(creatives.map((c) => c.id));
  const counts: Partial<Record<CreativeStatus, number>> = {};
  for (const c of creatives) {
    const v = versions[c.id];
    if (!v) continue;
    const ev = await evaluateVersion(c, v, campaign);
    counts[ev.status] = (counts[ev.status] ?? 0) + 1;
  }
  return counts;
}

export const ConceptReviewSchema = z.object({ decision: z.enum(['aprovado', 'reprovado']), comment: z.string().max(1000).optional(), suggestLearning: z.boolean().optional() });

export async function reviewConcept(conceptId: string, raw: unknown, reviewerId: string) {
  const body = ConceptReviewSchema.parse(raw);
  const concept = await getConcept(conceptId);
  if (!concept) throw notFound('Conceito');
  if (concept.status === 'substituido') throw badRequest('Este conceito foi substituído por uma versão mais nova.');
  if (body.decision === 'reprovado' && !body.comment) throw badRequest('Explique o motivo da reprovação.');
  if (body.decision === 'aprovado') {
    const campaign = await getCampaign(concept.campaignId);
    const issues = campaign ? await messageIssues(campaign, concept) : {};
    const critical = Object.values(issues).flat().filter((r) => r.severity === 'critico');
    if (critical.length) throw badRequest(`Textos por canal com bloqueio: ${critical.map((r) => r.message).join(' ')} Corrija na aba Conceito antes de aprovar.`);
  }
  await setConceptStatus(conceptId, body.decision, reviewerId);
  const reviewId = await insertReview({ creativeId: null, versionId: null, conceptId, reviewerId, decision: body.decision, comment: body.comment ?? null });
  let learningId: string | undefined;
  if (body.decision === 'reprovado' && body.suggestLearning && body.comment) learningId = await insertLearning({ text: body.comment, source: `Reprovação do conceito #${concept.number}`, sourceReviewId: reviewId, createdBy: reviewerId });
  const counts = await reevaluateCampaign(concept.campaignId);
  await audit({ campaignId: concept.campaignId, actorId: reviewerId, type: `concept.${body.decision}`, payload: { conceptId, number: concept.number, comment: body.comment, statusCounts: counts, learningId } });
  return { statusCounts: counts, learningId };
}

export const CreativeReviewSchema = z.object({
  versionId: z.string(),
  decision: z.enum(['aprovado', 'ajustes']),
  comment: z.string().max(1000).optional(),
  suggestLearning: z.boolean().optional(),
});

export async function reviewCreative(creativeId: string, raw: unknown, reviewerId: string) {
  const body = CreativeReviewSchema.parse(raw);
  const { creative, version, report } = await evaluateCreativeById(creativeId);
  if (version.id !== body.versionId) throw conflict(`A peça tem uma versão mais nova (v${version.number}). Revise a versão atual.`);
  if (body.decision === 'aprovado' && !report.passed) throw badRequest('Esta versão tem bloqueio crítico e não pode ser aprovada.');
  if (body.decision === 'ajustes' && !body.comment) throw badRequest('Descreva os ajustes necessários.');
  const reviewId = await insertReview({ creativeId, versionId: version.id, conceptId: null, reviewerId, decision: body.decision, comment: body.comment ?? null });
  let learningId: string | undefined;
  if (body.decision === 'ajustes' && body.suggestLearning && body.comment) learningId = await insertLearning({ text: body.comment, source: `Ajuste pedido na peça ${creative.format}/${creative.praca} v${version.number}`, sourceReviewId: reviewId, createdBy: reviewerId });
  const ev = await evaluateVersion({ ...creative, currentVersionId: version.id }, version);
  await audit({ campaignId: creative.campaignId, creativeId, versionId: version.id, actorId: reviewerId, type: `review.${body.decision}`, payload: { number: version.number, comment: body.comment, status: ev.status, learningId } });
  return { status: ev.status, learningId };
}

export async function batchApprove(ids: string[], reviewerId: string) {
  const results: { creativeId: string; ok: boolean; status?: string; error?: string }[] = [];
  for (const id of ids) {
    try {
      const { version } = await evaluateCreativeById(id);
      const r = await reviewCreative(id, { versionId: version.id, decision: 'aprovado' }, reviewerId);
      results.push({ creativeId: id, ok: true, status: r.status });
    } catch (e) {
      results.push({ creativeId: id, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

/** Fila do revisor: conceitos pendentes + exceções (o resto foi aprovado por herança). */
export async function reviewQueue() {
  const creatives = await listCreativesByStatus(['aguardando_revisao']);
  const versions = await getCurrentVersions(creatives.map((c) => c.id));
  const campaigns = new Map((await listCampaigns()).map((c) => [c.id, c]));
  const items = [];
  for (const c of creatives) {
    const v = versions[c.id];
    if (!v) continue;
    let base = null;
    if (v.origin !== 'derivada') {
      // versão derivada mais recente para comparação
      const all = await listVersions(c.id);
      base = all.find((x) => x.origin === 'derivada' && x.number < v.number) ?? all.find((x) => x.number === v.number - 1) ?? null;
    }
    items.push({ creative: c, version: v, campaign: campaigns.get(c.campaignId) ?? null, baseVersion: base ? { id: base.id, number: base.number, doc: base.doc } : null });
  }
  const concepts: (ConceptRow & { campaignName: string; pending: number })[] = [];
  for (const camp of campaigns.values()) {
    const cc = await getCurrentConcept(camp.id);
    if (cc?.status === 'proposto') {
      const pending = (await listCreatives(camp.id)).filter((x) => x.status === 'aguardando_conceito').length;
      if (pending > 0) concepts.push({ ...cc, campaignName: camp.name, pending });
    }
  }
  return { concepts, items };
}

export async function getVersionOrThrow(id: string) {
  const v = await getVersion(id);
  if (!v) throw notFound('Versão');
  return v;
}
