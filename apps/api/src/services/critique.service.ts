import { FORMATS, resolveLayerText } from '@cf/shared';
import { audit, insertCritique, latestCritique, listLearnings } from '../models/governance.model';
import { runAI } from './ai';
import { renderPng } from './render.service';
import { evaluateCreativeById } from './validation.service';

/**
 * Revisor de marca com IA multimodal: olha o PNG renderizado e dá nota + sugestões.
 * É CONSULTIVO: nunca bloqueia nem aprova. Bloqueio é papel das regras determinísticas.
 */
export async function critiqueCreative(creativeId: string, userId: string) {
  const { creative, version, ctx } = await evaluateCreativeById(creativeId);
  const png = await renderPng(version.doc, ctx);
  const learnings = await listLearnings('ativa');
  const textSummary = version.doc.layers
    .filter((l) => l.kind === 'text' && !l.hidden)
    .map((l) => `${l.role}: ${resolveLayerText(l, ctx)}`)
    .join(' | ');
  const out = await runAI((p) => p.critique({ png, doc: version.doc, format: FORMATS[version.doc.format], learnings: learnings.map((l) => l.text), textSummary }));
  const id = await insertCritique({ creativeId, versionId: version.id, provider: out.provider, data: out.result });
  await audit({ campaignId: creative.campaignId, creativeId, versionId: version.id, actorId: userId, type: 'ai.critique', payload: { score: out.result.score, provider: out.provider, fallback: out.fallback, ms: out.ms } });
  return { id, versionId: version.id, provider: out.provider, fallback: out.fallback, ...out.result };
}

export async function getCritique(versionId: string) {
  return latestCritique(versionId);
}
