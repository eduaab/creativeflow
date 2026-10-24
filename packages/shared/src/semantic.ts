import { ROLE_LABELS, type Concept, type CreativeDoc, type FormatId } from './domain';
import { ruleResult, type RuleResult } from './rules';

/**
 * REVISÃO SEMÂNTICA PELA IA (regra IA-001)
 *
 * Camada ADICIONAL às regras em código: a IA lê os textos e aponta riscos que uma lista
 * fixa não pega (alegação de saúde disfarçada, promessa comercial implícita, tom fora da
 * marca, estereótipo, incoerência, remédio direcionado a crianças).
 * Princípio: a IA só ENDURECE. Um apontamento manda a peça para a fila de exceções
 * (alerta); a ausência de apontamento não libera nada. Bloqueio crítico continua sendo
 * exclusivo das regras determinísticas.
 */

export const SEMANTIC_CATEGORIES = ['alegacao_saude', 'promessa_comercial', 'tom_de_voz', 'estereotipo', 'coerencia', 'publico_infantil'] as const;
export type SemanticCategory = (typeof SEMANTIC_CATEGORIES)[number];

export const SEMANTIC_LABELS: Record<SemanticCategory, string> = {
  alegacao_saude: 'Possível alegação de saúde',
  promessa_comercial: 'Promessa comercial implícita',
  tom_de_voz: 'Tom fora da marca',
  estereotipo: 'Possível estereótipo',
  coerencia: 'Texto incoerente com o produto',
  publico_infantil: 'Medicamento direcionado a crianças',
};

export interface SemanticText {
  /** Referência estável do texto (ex.: "v:geral:headline", "layer:subheadline"). */
  ref: string;
  label: string;
  segmentId: string | null;
  text: string;
}

export interface SemanticFinding {
  id: string;
  ref: string;
  category: SemanticCategory;
  excerpt: string;
  explanation: string;
  suggestion: string | null;
}

export interface SemanticCheck {
  hash: string;
  provider: string;
  fallback: boolean;
  error: string | null;
  findings: SemanticFinding[];
  /** ids de apontamentos descartados pelo revisor, com motivo. */
  dismissed: Record<string, { by: string; reason: string; at: string }>;
  createdAt: string;
}

const VARIANT_FIELDS: [keyof Concept['variants'][number], string][] = [
  ['headline', 'Título'],
  ['shortHeadline', 'Título curto'],
  ['subheadline', 'Subtítulo'],
  ['cta', 'CTA'],
  ['badge', 'Selo'],
];
const MESSAGE_FIELDS_LABEL: [string, string][] = [
  ['pushTitle', 'Push — título'],
  ['pushBody', 'Push — texto'],
  ['emailSubject', 'E-mail — assunto'],
  ['emailPreheader', 'E-mail — pré-cabeçalho'],
  ['whatsapp', 'WhatsApp'],
];

/** Todos os textos criativos de um conceito (peças + canais). */
export function conceptTexts(c: Concept): SemanticText[] {
  const out: SemanticText[] = [{ ref: 'encarte:headline', label: 'Título do encarte', segmentId: null, text: c.encarteHeadline }];
  for (const v of c.variants) {
    for (const [k, label] of VARIANT_FIELDS) {
      const t = v[k];
      if (typeof t === 'string' && t.trim()) out.push({ ref: `v:${v.segmentId}:${k}`, label, segmentId: v.segmentId, text: t });
    }
    const m = v.messages as Record<string, string> | undefined;
    if (m) for (const [k, label] of MESSAGE_FIELDS_LABEL) if (m[k]?.trim()) out.push({ ref: `v:${v.segmentId}:messages.${k}`, label, segmentId: v.segmentId, text: m[k] });
  }
  return out;
}

/** Textos criativos livres de uma peça (camadas de texto sem vínculo com o cadastro). */
export function docTexts(doc: CreativeDoc): SemanticText[] {
  return doc.layers
    .filter((l) => l.kind === 'text' && !l.binding && !l.hidden && l.text?.trim())
    .map((l) => ({ ref: `layer:${l.id}`, label: ROLE_LABELS[l.role] ?? l.id, segmentId: doc.meta.segmentId, text: l.text! }));
}

const REF_TO_LAYER: Record<string, string> = { headline: 'headline', shortHeadline: 'headline', subheadline: 'subheadline', cta: 'cta', badge: 'badge' };

/** Liga um apontamento a uma camada da peça (ou null se não se aplica a ela). */
export function findingLayer(ref: string, segmentId: string, format: FormatId): string | null | undefined {
  if (ref.startsWith('layer:')) return ref.slice(6);
  if (ref === 'encarte:headline') return format === 'encarte' ? 'headline' : undefined;
  const m = /^v:([^:]+):(\w+)$/.exec(ref);
  if (!m || m[1] !== segmentId) return undefined;
  if (format === 'encarte' && m[2] !== 'cta') return undefined;
  return REF_TO_LAYER[m[2]];
}

/**
 * Converte a verificação em resultados da regra IA-001 para uma peça.
 * Apontamento ativo → alerta (fila de exceções). Nunca gera "crítico".
 */
export function semanticResults(check: SemanticCheck | null, scope: { segmentId: string; format: FormatId }): RuleResult[] {
  if (!check) return [];
  const active = check.findings
    .filter((f) => !check.dismissed[f.id])
    .map((f) => ({ f, layer: findingLayer(f.ref, scope.segmentId, scope.format) }))
    .filter((x) => x.layer !== undefined);
  const how = check.fallback || check.provider === 'mock' ? ' (modo demonstração: heurística)' : '';
  if (!active.length) return [ruleResult('IA-001', true, `IA não encontrou riscos nos textos${how}.`)];
  return active.map(({ f, layer }) => ruleResult('IA-001', false, `${SEMANTIC_LABELS[f.category]}: "${f.excerpt}". ${f.explanation}${f.suggestion ? ` Sugestão: ${f.suggestion}` : ''}${how}`, layer ?? undefined));
}
