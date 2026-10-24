import {
  BriefingSchema,
  CATEGORY_LABELS,
  ConceptSchema,
  FORMATS,
  buildCreativeDoc,
  withMessages,
  diffDocs,
  type Briefing,
  type Concept,
  type CreativeStatus,
  type FormatId,
} from '@cf/shared';
import { getProducts, listSegments } from '../models/catalog.model';
import { getCampaign, getConcept, getCurrentConcept, insertCampaign, listApprovedConceptExamples, insertConcept, touchCampaign, type CampaignRow } from '../models/campaign.model';
import { getCurrentVersions, insertCreative, insertVersion, listCreatives, nextVersionNumber, type CreativeRow } from '../models/creative.model';
import { audit, listLearnings } from '../models/governance.model';
import { badRequest, notFound } from '../utils/errors';
import { newId } from '../utils/id';
import { runAI } from './ai';
import { notifyReviewers } from './notify.service';
import { checkConcept } from './semantic.service';
import { getRulesConfig, getToday } from './settings.service';
import { offerSource } from './sources';
import { evaluateVersion } from './validation.service';

export interface PreviewIssue {
  severity: 'critico' | 'alerta';
  praca?: string;
  sku?: string;
  message: string;
}

/** Validações ANTES de gerar: o sistema não inventa preço para praça sem oferta. */
export async function previewBriefing(raw: unknown) {
  const b = BriefingSchema.parse(raw);
  const products = await getProducts(b.skus);
  const segments = await listSegments();
  const today = await getToday();
  const issues: PreviewIssue[] = [];
  for (const praca of b.pracas) {
    const offers = await offerSource.getOffers(praca, b.skus);
    for (const sku of b.skus) {
      const p = products[sku];
      const o = offers[sku];
      const name = p?.name ?? sku;
      if (!o) issues.push({ severity: 'critico', praca, sku, message: `${name}: sem oferta cadastrada em ${praca}. As peças dessa praça ficarão bloqueadas até cadastrar a oferta.` });
      else if (o.status !== 'ativa' || o.endsAt < today) issues.push({ severity: 'critico', praca, sku, message: `${name}: oferta de ${praca} vencida ou inativa (fim ${o.endsAt}).` });
      else if (o.startsAt > b.startsAt || o.endsAt < b.endsAt) issues.push({ severity: 'critico', praca, sku, message: `${name}: oferta de ${praca} (${o.startsAt} a ${o.endsAt}) não cobre o período da campanha.` });
    }
  }
  for (const sku of b.skus) {
    const p = products[sku];
    if (!p) issues.push({ severity: 'critico', sku, message: `${sku}: produto não encontrado no catálogo.` });
    else if (p.category === 'rx') issues.push({ severity: 'critico', sku, message: `${p.name}: ${CATEGORY_LABELS.rx.toLowerCase()} — comunicação ao público geral bloqueada.` });
    else if (p.category === 'mip') {
      issues.push({ severity: 'alerta', sku, message: `${p.name}: medicamento isento de prescrição — advertência obrigatória será incluída automaticamente.` });
      const kids = b.segments.map((id) => segments.find((s) => s.id === id)).filter((s) => s?.involvesChildren);
      if (kids.length) issues.push({ severity: 'alerta', sku, message: `${p.name}: público "${kids[0]!.name}" exige revisão especializada para medicamento.` });
    }
    if (p && p.image.type === 'none') issues.push({ severity: 'alerta', sku, message: `${p.name}: sem imagem autorizada; será usado placeholder identificado.` });
  }
  const single = b.formats.filter((f) => !FORMATS[f].multiProduct);
  const multi = b.formats.filter((f) => FORMATS[f].multiProduct);
  const perPraca = b.segments.length * (single.length * b.skus.length + multi.length);
  return {
    totalPieces: perPraca * b.pracas.length,
    breakdown: { pracas: b.pracas.length, segments: b.segments.length, products: b.skus.length, singleFormats: single.length, multiFormats: multi.length },
    issues,
  };
}

export async function createCampaign(raw: unknown, userId: string): Promise<CampaignRow> {
  const b = BriefingSchema.parse(raw);
  if (b.endsAt < b.startsAt) throw badRequest('A data final da campanha é anterior à inicial.');
  const id = newId('cmp');
  await insertCampaign({ id, briefing: b, createdBy: userId });
  await audit({ campaignId: id, actorId: userId, type: 'campaign.created', payload: { briefing: b } });
  return (await getCampaign(id))!;
}

function ensureVariants(concept: Concept, b: Briefing): Concept {
  const variants = b.segments.map((sid) => withMessages(concept.variants.find((v) => v.segmentId === sid) ?? { ...concept.variants[0], segmentId: sid }));
  return { ...concept, variants };
}

export async function generateConcept(campaignId: string, userId: string, feedback?: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const b = campaign.briefing;
  const [productsMap, segments, rules, learnings, previous, examples] = await Promise.all([
    getProducts(b.skus),
    listSegments(),
    getRulesConfig(),
    listLearnings('ativa'),
    getCurrentConcept(campaignId),
    listApprovedConceptExamples(campaignId),
  ]);
  const approvedExamples = examples.map((e) => {
    const v = e.data.variants.find((x) => x.segmentId === 'geral') ?? e.data.variants[0];
    return { campanha: e.campaign, objetivo: e.objective, tema: e.data.theme, titulo: v.headline, subtitulo: v.subheadline };
  });
  const out = await runAI((p) =>
    p.generateConcept({
      briefing: b,
      products: b.skus.map((s) => productsMap[s]).filter(Boolean),
      segments: segments.filter((s) => b.segments.includes(s.id)),
      rules,
      learnings: learnings.map((l) => l.text),
      previous: previous?.data,
      feedback,
      approvedExamples,
    }),
  );
  const data = ensureVariants(ConceptSchema.parse(out.result), b);
  const concept = await insertConcept({ id: newId('cpt'), campaignId, data, source: out.provider + (out.fallback ? ' (contingência)' : ''), createdBy: userId });
  const semantic = await checkConcept(campaign, concept, userId);
  await audit({ campaignId, actorId: userId, type: 'concept.generated', payload: { conceptId: concept.id, number: concept.number, provider: out.provider, fallback: out.fallback, error: out.error, ms: out.ms, feedback, examples: approvedExamples.length } });
  await touchCampaign(campaignId);
  return { concept, ai: { provider: out.provider, fallback: out.fallback, ms: out.ms, examples: approvedExamples.length, semanticFindings: semantic?.findings.length ?? 0 } };
}

/** Edição humana do conceito (textos globais) → novo conceito, propaga para peças derivadas. */
export async function editConcept(campaignId: string, data: unknown, userId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const parsed = ensureVariants(ConceptSchema.parse(data), campaign.briefing);
  const concept = await insertConcept({ id: newId('cpt'), campaignId, data: parsed, source: 'manual', createdBy: userId });
  await checkConcept(campaign, concept, userId);
  await audit({ campaignId, actorId: userId, type: 'concept.edited', payload: { conceptId: concept.id, number: concept.number } });
  return concept;
}

/**
 * Gera (ou regenera) TODAS as peças da campanha a partir do conceito atual.
 * Peças editadas por humano/IA não são sobrescritas: ficam marcadas para revisão.
 */
export async function generatePieces(campaignId: string, userId: string) {
  const t0 = Date.now();
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const concept = await getCurrentConcept(campaignId);
  if (!concept) throw badRequest('Gere ou escreva o conceito antes de gerar as peças.');
  const b = campaign.briefing;
  const products = await getProducts(b.skus);
  const existing = await listCreatives(campaignId);
  const currentVersions = await getCurrentVersions(existing.map((c) => c.id));
  const key = (format: string, praca: string, seg: string, skus: string[]) => `${format}|${praca}|${seg}|${skus.join(',')}`;
  const byKey = new Map(existing.map((c) => [key(c.format, c.praca, c.segmentId, c.skus), c]));

  const jobs: { format: FormatId; praca: string; segmentId: string; skus: string[] }[] = [];
  for (const praca of b.pracas)
    for (const segmentId of b.segments)
      for (const format of b.formats) {
        if (FORMATS[format].multiProduct) jobs.push({ format, praca, segmentId, skus: b.skus.slice(0, 6) });
        else for (const sku of b.skus) jobs.push({ format, praca, segmentId, skus: [sku] });
      }

  let created = 0;
  let updated = 0;
  let kept = 0;
  const statusCounts: Partial<Record<CreativeStatus, number>> = {};
  for (const job of jobs) {
    const variant = concept.data.variants.find((v) => v.segmentId === job.segmentId) ?? concept.data.variants[0];
    const doc = buildCreativeDoc({
      format: job.format,
      family: concept.data.layoutFamily,
      backgroundStyle: concept.data.backgroundStyle,
      variant,
      encarteHeadline: concept.data.encarteHeadline,
      skus: job.skus,
      products,
      praca: job.praca,
      segmentId: job.segmentId,
    });
    let creative: CreativeRow | undefined = byKey.get(key(job.format, job.praca, job.segmentId, job.skus));
    const current = creative ? currentVersions[creative.id] : undefined;
    if (creative && current && current.origin !== 'derivada') {
      kept++;
      const ev = await evaluateVersion(creative, current, campaign);
      statusCounts[ev.status] = (statusCounts[ev.status] ?? 0) + 1;
      continue;
    }
    if (creative && current && current.conceptId === concept.id) {
      kept++;
      const ev = await evaluateVersion(creative, current, campaign);
      statusCounts[ev.status] = (statusCounts[ev.status] ?? 0) + 1;
      continue;
    }
    if (!creative) {
      creative = { id: newId('pc'), campaignId, format: job.format, praca: job.praca, segmentId: job.segmentId, skus: job.skus, status: 'rascunho', currentVersionId: null, exceptionReason: null, createdAt: '', updatedAt: '' };
      await insertCreative(creative);
      created++;
    } else updated++;
    const versionId = newId('v');
    const number = await nextVersionNumber(creative.id);
    const version = {
      id: versionId,
      creativeId: creative.id,
      number,
      doc,
      origin: 'derivada' as const,
      conceptId: concept.id,
      authorId: userId,
      instruction: current ? `Regerada a partir do conceito #${concept.number}` : `Gerada a partir do conceito #${concept.number}`,
      ops: null,
      rejected: null,
      diff: current ? diffDocs(current.doc, doc) : null,
      validation: null,
      status: 'rascunho' as const,
    };
    await insertVersion(version);
    const ev = await evaluateVersion({ ...creative, currentVersionId: null }, { ...version, createdAt: new Date().toISOString() }, campaign);
    statusCounts[ev.status] = (statusCounts[ev.status] ?? 0) + 1;
  }
  const ms = Date.now() - t0;
  await audit({ campaignId, actorId: userId, type: 'pieces.generated', payload: { conceptId: concept.id, total: jobs.length, created, updated, kept, statusCounts, ms } });
  await touchCampaign(campaignId);
  if ((statusCounts.aguardando_revisao ?? 0) > 0) {
    await notifyReviewers({ campaignId, title: `${statusCounts.aguardando_revisao} peça(s) na fila de exceções`, text: `Campanha "${campaign.name}": peças com alerta aguardam revisão individual.` });
  }
  if (concept.status === 'proposto') {
    await notifyReviewers({ campaignId, title: 'Conceito aguardando aprovação', text: `Campanha "${campaign.name}": aprove o conceito #${concept.number} para liberar ${statusCounts.aguardando_conceito ?? 0} peça(s) derivada(s).` });
  }
  return { total: jobs.length, created, updated, kept, statusCounts, ms, conceptId: concept.id };
}

export async function getConceptOrThrow(id: string) {
  const c = await getConcept(id);
  if (!c) throw notFound('Conceito');
  return c;
}
