import {
  FORMATS,
  PatchOpSchema,
  allowedPaths,
  applyOps,
  diffDocs,
  filterOps,
  validateCreative,
  semanticResults,
  PROTECTED_CONTENT_ROLES,
  type CreativeDoc,
  type PatchOp,
} from '@cf/shared';
import { z } from 'zod';
import { getCampaign, getConcept } from '../models/campaign.model';
import {
  getCreative,
  getProposal,
  getSiblings,
  getVersion,
  insertProposal,
  insertVersion,
  nextVersionNumber,
  setProposalStatus,
  type CreativeRow,
  type VersionRow,
} from '../models/creative.model';
import { audit, listLearnings } from '../models/governance.model';
import { badRequest, conflict, notFound } from '../utils/errors';
import { newId } from '../utils/id';
import { runAI, type EditResult, type LayerSummary } from './ai';
import { buildContext, getSegment } from './context.service';
import { getRulesConfig } from './settings.service';
import { checkDoc } from './semantic.service';
import { evaluateVersion } from './validation.service';

async function loadCurrent(creativeId: string): Promise<{ creative: CreativeRow; version: VersionRow }> {
  const creative = await getCreative(creativeId);
  if (!creative?.currentVersionId) throw notFound('Peça');
  const version = await getVersion(creative.currentVersionId);
  if (!version) throw notFound('Versão');
  return { creative, version };
}

async function saveNewVersion(p: {
  creative: CreativeRow;
  base: VersionRow;
  doc: CreativeDoc;
  origin: 'manual' | 'ia';
  authorId: string;
  instruction: string | null;
  ops: PatchOp[];
  rejected: unknown[];
}) {
  const id = newId('v');
  const number = await nextVersionNumber(p.creative.id);
  const diff = diffDocs(p.base.doc, p.doc);
  const v: VersionRow = {
    id,
    creativeId: p.creative.id,
    number,
    doc: p.doc,
    origin: p.origin,
    conceptId: p.base.conceptId,
    authorId: p.authorId,
    instruction: p.instruction,
    ops: p.ops,
    rejected: p.rejected as never,
    diff,
    validation: null,
    status: 'rascunho',
    createdAt: new Date().toISOString(),
  };
  await insertVersion(v);
  await checkDoc(p.creative, p.doc); // revisão semântica dos textos novos (reaproveitada se o texto já foi visto)
  const ev = await evaluateVersion({ ...p.creative, currentVersionId: null }, v);
  await audit({
    campaignId: p.creative.campaignId,
    creativeId: p.creative.id,
    versionId: id,
    actorId: p.authorId,
    type: 'version.created',
    payload: { number, origin: p.origin, instruction: p.instruction, changes: diff.length, status: ev.status, critical: ev.report.counts.critico, alerts: ev.report.counts.alerta, approvalReset: p.base.status === 'aprovado' || p.base.status === 'aprovado_por_heranca' },
  });
  return { version: { ...v, validation: ev.report, status: ev.status }, evaluation: ev };
}

/* ------------------------------------------------------------------ */
/* Edição manual (canvas)                                              */
/* ------------------------------------------------------------------ */

export const ManualEditSchema = z.object({ baseVersionId: z.string(), ops: z.array(PatchOpSchema).min(1).max(200) });

export async function manualEdit(creativeId: string, raw: unknown, userId: string) {
  const body = ManualEditSchema.parse(raw);
  const { creative, version } = await loadCurrent(creativeId);
  if (version.id !== body.baseVersionId) throw conflict('A peça foi alterada por outra pessoa. Recarregue antes de salvar.', { currentVersionId: version.id });
  const { allowed, rejected } = filterOps(version.doc, body.ops);
  const blocked = rejected.filter((r) => r.protectedField);
  if (blocked.length)
    await audit({ campaignId: creative.campaignId, creativeId, versionId: version.id, actorId: userId, type: 'edit.protected_field_blocked', payload: { source: 'manual', rejected: blocked } });
  if (!allowed.length) throw badRequest('Nenhuma alteração permitida foi enviada.', { rejected });
  const doc = applyOps(version.doc, allowed);
  if (!diffDocs(version.doc, doc).length) throw badRequest('Nada mudou em relação à versão atual.');
  return { ...(await saveNewVersion({ creative, base: version, doc, origin: 'manual', authorId: userId, instruction: null, ops: allowed, rejected })), rejected };
}

/* ------------------------------------------------------------------ */
/* Edição por linguagem natural (copiloto)                             */
/* ------------------------------------------------------------------ */

export const AiEditSchema = z.object({ instruction: z.string().min(3).max(500), scope: z.enum(['piece', 'siblings']).default('piece') });

/** Barreira determinística ANTES da IA: valores comerciais e pedidos de publicação nem chegam ao modelo. */
export function guardInstruction(text: string): EditResult['refusal'] {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/(r\$\s?\d|\d+[.,]\d{2}\b|\d+\s?%|\bleve\s+\d+\s+pague)/.test(t))
    return { category: 'dado_comercial', message: 'Valores, percentuais e condições comerciais vêm do cadastro de ofertas e não podem ser definidos por pedido à IA. Atualize a oferta na fonte, com autorização.' };
  if (/\b(publique|publicar|postar|poste|aprove|aprovar)\b|sem aprovacao|pul(e|ar) a revisao/.test(t))
    return { category: 'processo', message: 'A IA não publica nem aprova peças. Envie para revisão; a exportação é liberada somente após aprovação.' };
  return null;
}

function summarizeLayers(doc: CreativeDoc): LayerSummary[] {
  return doc.layers.map((l) => ({
    id: l.id,
    role: l.role,
    kind: l.kind,
    text: l.binding ? undefined : l.text,
    protected: !!l.binding || PROTECTED_CONTENT_ROLES.includes(l.role),
    x: l.x,
    y: l.y,
    w: l.w,
    h: l.h,
    style: l.style as Record<string, unknown>,
    allowedPaths: allowedPaths(l),
  }));
}

function toPatchOps(result: EditResult): PatchOp[] {
  const out: PatchOp[] = [];
  for (const o of result.ops) {
    if (o.op === 'remove') out.push({ op: 'remove', layerId: o.layerId });
    else if (o.path !== undefined && o.value !== undefined) out.push({ op: 'set', layerId: o.layerId, path: o.path, value: o.value });
  }
  return out;
}

export async function proposeAiEdit(creativeId: string, raw: unknown, userId: string) {
  const body = AiEditSchema.parse(raw);
  const { creative, version } = await loadCurrent(creativeId);
  const campaign = (await getCampaign(creative.campaignId))!;
  const proposalId = newId('prop');
  const base = { campaignId: creative.campaignId, creativeId, versionId: version.id, actorId: userId };

  const guard = guardInstruction(body.instruction);
  if (guard) {
    const data = { summary: 'Pedido recusado pela barreira de governança (antes da IA).', ops: [], rejected: [], refusal: guard, provider: 'regra', fallback: false };
    await insertProposal({ id: proposalId, creativeId, baseVersionId: version.id, instruction: body.instruction, scope: body.scope, data, status: 'recusada', authorId: userId });
    await audit({ ...base, type: 'ai.edit.refused', payload: { instruction: body.instruction, refusal: guard, by: 'regra' } });
    return { proposalId, status: 'recusada' as const, ...data, previewDoc: null, diff: [], validation: null };
  }

  const concept = version.conceptId ? await getConcept(version.conceptId) : undefined;
  const variant = concept?.data.variants.find((v) => v.segmentId === creative.segmentId);
  const [rules, learnings] = await Promise.all([getRulesConfig(), listLearnings('ativa')]);
  const out = await runAI((p) =>
    p.interpretEdit({ instruction: body.instruction, doc: version.doc, layers: summarizeLayers(version.doc), format: FORMATS[version.doc.format], variant, rules, learnings: learnings.map((l) => l.text) }),
  );
  const result = out.result;
  if (result.refusal || !result.ops.length) {
    const refusal = result.refusal ?? { category: 'nao_entendi' as const, message: 'A IA não propôs alterações.' };
    const data = { summary: result.summary, ops: [], rejected: [], refusal, provider: out.provider, fallback: out.fallback, error: out.error };
    await insertProposal({ id: proposalId, creativeId, baseVersionId: version.id, instruction: body.instruction, scope: body.scope, data, status: 'recusada', authorId: userId });
    await audit({ ...base, type: 'ai.edit.refused', payload: { instruction: body.instruction, refusal, by: out.provider, aiError: out.error } });
    return { proposalId, status: 'recusada' as const, ...data, previewDoc: null, diff: [], validation: null };
  }

  const parsed = z.array(PatchOpSchema).safeParse(toPatchOps(result));
  const ops = parsed.success ? parsed.data : [];
  const { allowed, rejected } = filterOps(version.doc, ops);
  const previewDoc = applyOps(version.doc, allowed);
  const diff = diffDocs(version.doc, previewDoc);
  const ctx = await buildContext(previewDoc, campaign);
  const semCheck = await checkDoc(creative, previewDoc);
  const extra = semanticResults(semCheck, { segmentId: creative.segmentId, format: previewDoc.format });
  const validation = validateCreative(previewDoc, ctx, { config: rules, segment: await getSegment(creative.segmentId), extra });
  const data = { summary: result.summary, ops: allowed, rejected, refusal: null, provider: out.provider, fallback: out.fallback, error: out.error, ms: out.ms };
  await insertProposal({ id: proposalId, creativeId, baseVersionId: version.id, instruction: body.instruction, scope: body.scope, data, status: 'pendente', authorId: userId });
  await audit({ ...base, type: 'ai.edit.proposed', payload: { proposalId, instruction: body.instruction, ops: allowed.length, provider: out.provider, fallback: out.fallback, aiError: out.error, ms: out.ms } });
  const blocked = rejected.filter((r) => r.protectedField);
  if (blocked.length) await audit({ ...base, type: 'edit.protected_field_blocked', payload: { source: 'ia', instruction: body.instruction, rejected: blocked } });
  return { proposalId, status: 'pendente' as const, ...data, previewDoc, diff, validation };
}

export async function applyAiEdit(proposalId: string, userId: string) {
  const prop = await getProposal(proposalId);
  if (!prop) throw notFound('Proposta');
  if (prop.status !== 'pendente') throw badRequest(`Proposta já está ${prop.status}.`);
  const { creative, version } = await loadCurrent(prop.creativeId);
  if (version.id !== prop.baseVersionId) throw conflict('A peça mudou desde a prévia. Peça a alteração novamente.');
  const ops = (prop.data.ops ?? []) as PatchOp[];
  const { allowed, rejected } = filterOps(version.doc, ops);
  const saved = await saveNewVersion({ creative, base: version, doc: applyOps(version.doc, allowed), origin: 'ia', authorId: userId, instruction: prop.instruction, ops: allowed, rejected });
  const replicated: { creativeId: string; praca: string; versionNumber: number; status: string }[] = [];
  if (prop.scope === 'siblings') {
    for (const sib of await getSiblings(creative)) {
      if (!sib.currentVersionId) continue;
      const sv = await getVersion(sib.currentVersionId);
      if (!sv) continue;
      const f = filterOps(sv.doc, ops);
      if (!f.allowed.length) continue;
      const r = await saveNewVersion({ creative: sib, base: sv, doc: applyOps(sv.doc, f.allowed), origin: 'ia', authorId: userId, instruction: `${prop.instruction} (replicado da peça ${creative.praca})`, ops: f.allowed, rejected: f.rejected });
      replicated.push({ creativeId: sib.id, praca: sib.praca, versionNumber: r.version.number, status: r.version.status });
    }
  }
  await setProposalStatus(proposalId, 'aplicada');
  await audit({ campaignId: creative.campaignId, creativeId: creative.id, versionId: saved.version.id, actorId: userId, type: 'ai.edit.applied', payload: { proposalId, instruction: prop.instruction, replicated } });
  return { ...saved, replicated };
}

export async function discardAiEdit(proposalId: string, userId: string) {
  const prop = await getProposal(proposalId);
  if (!prop) throw notFound('Proposta');
  if (prop.status === 'pendente') await setProposalStatus(proposalId, 'descartada');
  const c = await getCreative(prop.creativeId);
  await audit({ campaignId: c?.campaignId, creativeId: prop.creativeId, actorId: userId, type: 'ai.edit.discarded', payload: { proposalId } });
  return { ok: true };
}

/** Restaura uma versão anterior como NOVA versão (histórico é imutável). */
export async function restoreVersion(creativeId: string, versionId: string, userId: string) {
  const { creative, version } = await loadCurrent(creativeId);
  const old = await getVersion(versionId);
  if (!old || old.creativeId !== creativeId) throw notFound('Versão');
  if (old.id === version.id) throw badRequest('Esta já é a versão atual.');
  return saveNewVersion({ creative, base: version, doc: old.doc, origin: 'manual', authorId: userId, instruction: `Restaurada a partir da v${old.number}`, ops: [], rejected: [] });
}
