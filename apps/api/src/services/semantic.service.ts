import { createHash } from 'node:crypto';
import {
  conceptTexts,
  docTexts,
  semanticResults,
  type CreativeDoc,
  type RuleResult,
  type SemanticCheck,
  type SemanticFinding,
  type SemanticText,
} from '@cf/shared';
import { getCampaign, getConcept, getCurrentConcept, type CampaignRow, type ConceptRow } from '../models/campaign.model';
import { getProducts, listSegments } from '../models/catalog.model';
import { getCreative, getVersion, type CreativeRow, type VersionRow } from '../models/creative.model';
import { audit, listLearnings } from '../models/governance.model';
import { getSemanticCheck, insertSemanticCheck, setSemanticDismissed } from '../models/semantic.model';
import { badRequest, notFound } from '../utils/errors';
import { runAI } from './ai';
import { getRulesConfig } from './settings.service';

/**
 * Revisão semântica (IA-001). A verificação é guardada por HASH dos textos + contexto
 * (produtos e público): o mesmo texto não é enviado à IA duas vezes (réplicas entre
 * praças, reavaliações, restaurações). A avaliação das peças só LÊ o resultado guardado;
 * a chamada à IA acontece quando o texto nasce (conceito, edição, prévia do copiloto).
 */

function hashOf(texts: SemanticText[], skus: string[]): string {
  const payload = JSON.stringify({ t: texts.map((t) => [t.ref, t.segmentId, t.text]), s: [...skus].sort() });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function findingId(f: { ref: string; category: string; excerpt: string }): string {
  return 'f' + createHash('sha1').update(`${f.ref}|${f.category}|${f.excerpt}`).digest('hex').slice(0, 10);
}

async function ensureCheck(texts: SemanticText[], skus: string[], segmentIds: string[]): Promise<SemanticCheck | null> {
  if (!texts.length) return null;
  const hash = hashOf(texts, skus);
  const existing = await getSemanticCheck(hash);
  if (existing) return existing;
  const [productsMap, segments, rules, learnings] = await Promise.all([getProducts(skus), listSegments(), getRulesConfig(), listLearnings('ativa')]);
  const out = await runAI((p) =>
    p.semanticReview({ texts, products: Object.values(productsMap), segments: segments.filter((s) => segmentIds.includes(s.id)), learnings: learnings.map((l) => l.text), rules }),
  );
  const refs = new Set(texts.map((t) => t.ref));
  const seen = new Set<string>();
  const findings: SemanticFinding[] = [];
  for (const f of out.result.findings) {
    if (!refs.has(f.ref)) continue; // IA citou um texto que não existe: descarta
    const id = findingId(f);
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push({ id, ...f, suggestion: f.suggestion ?? null });
  }
  await insertSemanticCheck({ hash, provider: out.provider, fallback: out.fallback, error: out.error ?? null, findings });
  return getSemanticCheck(hash);
}

const conceptKey = (campaign: CampaignRow, concept: ConceptRow) => ({ texts: conceptTexts(concept.data), skus: campaign.briefing.skus, segs: concept.data.variants.map((v) => v.segmentId) });
const docKey = (creative: CreativeRow, doc: CreativeDoc) => ({ texts: docTexts(doc), skus: creative.skus, segs: [creative.segmentId] });

/** Roda (ou reaproveita) a revisão dos textos do conceito. Chamado ao gerar/editar o conceito. */
export async function checkConcept(campaign: CampaignRow, concept: ConceptRow, actorId: string) {
  const k = conceptKey(campaign, concept);
  const check = await ensureCheck(k.texts, k.skus, k.segs);
  if (check) await audit({ campaignId: campaign.id, actorId, type: 'ai.semantic', payload: { target: `conceito #${concept.number}`, findings: check.findings.length, provider: check.provider, fallback: check.fallback, aiError: check.error } });
  return check;
}

/** Roda (ou reaproveita) a revisão dos textos de uma peça editada. */
export async function checkDoc(creative: CreativeRow, doc: CreativeDoc) {
  const k = docKey(creative, doc);
  return ensureCheck(k.texts, k.skus, k.segs);
}

/** Lê (sem chamar a IA) a revisão que vale para esta versão. */
export async function lookupForVersion(creative: CreativeRow, version: VersionRow, concept?: ConceptRow | null, campaign?: CampaignRow | null): Promise<SemanticCheck | null> {
  if (version.origin === 'derivada') {
    if (!concept || !campaign) return null;
    const k = conceptKey(campaign, concept);
    return getSemanticCheck(hashOf(k.texts, k.skus));
  }
  const k = docKey(creative, version.doc);
  return k.texts.length ? getSemanticCheck(hashOf(k.texts, k.skus)) : null;
}

export async function semanticResultsFor(creative: CreativeRow, version: VersionRow, concept: ConceptRow | null | undefined, campaign: CampaignRow): Promise<RuleResult[]> {
  const check = await lookupForVersion(creative, version, concept, campaign);
  return semanticResults(check, { segmentId: creative.segmentId, format: version.doc.format });
}

export async function semanticForConcept(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const concept = await getCurrentConcept(campaignId);
  if (!concept) return null;
  const k = conceptKey(campaign, concept);
  const check = await getSemanticCheck(hashOf(k.texts, k.skus));
  return check && { ...check, texts: k.texts };
}

export async function semanticForCreative(creativeId: string) {
  const creative = await getCreative(creativeId);
  if (!creative?.currentVersionId) throw notFound('Peça');
  const version = (await getVersion(creative.currentVersionId))!;
  const campaign = await getCampaign(creative.campaignId);
  const concept = version.conceptId ? await getConcept(version.conceptId) : null;
  const check = await lookupForVersion(creative, version, concept, campaign);
  const texts = version.origin === 'derivada' && concept && campaign ? conceptKey(campaign, concept).texts : docTexts(version.doc);
  return check && { ...check, texts, source: version.origin === 'derivada' ? 'conceito' : 'versao' };
}

/** O revisor descarta um apontamento (falso positivo). Fica registrado com motivo. */
export async function dismissFinding(hash: string, findingIdToDismiss: string, reason: string, reviewerId: string, campaignId: string) {
  const check = await getSemanticCheck(hash);
  if (!check) throw notFound('Revisão semântica');
  const f = check.findings.find((x) => x.id === findingIdToDismiss);
  if (!f) throw notFound('Apontamento');
  if (!reason.trim()) throw badRequest('Informe o motivo do descarte.');
  await setSemanticDismissed(hash, { ...check.dismissed, [f.id]: { by: reviewerId, reason: reason.trim(), at: new Date().toISOString() } });
  await audit({ campaignId, actorId: reviewerId, type: 'ai.semantic.dismissed', payload: { excerpt: f.excerpt, category: f.category, reason } });
  return { ok: true };
}
