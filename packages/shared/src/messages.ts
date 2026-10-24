import {
  MESSAGE_LABELS,
  MESSAGE_LIMITS,
  type ChannelMessages,
  type CopyVariant,
  type MessageField,
  type Product,
  type RenderContext,
} from './domain';
import { formatBRL, validityText } from './format';
import { COMMERCIAL_IN_TEXT, DEFAULT_RULES_CONFIG, normalize, ruleResult, termIn, type RuleResult, type RulesConfig } from './rules';
import { wordsShorten } from './text';

/**
 * Textos por canal (push do app, e-mail e WhatsApp).
 * A IA escreve o texto CRIATIVO; preço, vigência e advertência entram pelo sistema
 * na hora de exportar, a partir do cadastro de ofertas da praça. As mesmas regras
 * de texto das peças (preço em texto livre, termos proibidos, alegações, tom) valem aqui.
 */

export const MESSAGE_FIELDS = Object.keys(MESSAGE_LIMITS) as MessageField[];

/** Textos de reserva derivados do título/subtítulo, para quando a IA não devolver os canais. */
export function defaultMessages(v: Pick<CopyVariant, 'headline' | 'shortHeadline' | 'subheadline' | 'cta'>): ChannelMessages {
  return {
    pushTitle: wordsShorten(v.shortHeadline, MESSAGE_LIMITS.pushTitle),
    pushBody: wordsShorten(`${v.subheadline} Toque para ver as ofertas.`, MESSAGE_LIMITS.pushBody),
    emailSubject: wordsShorten(v.headline, MESSAGE_LIMITS.emailSubject),
    emailPreheader: wordsShorten(v.subheadline, MESSAGE_LIMITS.emailPreheader),
    whatsapp: wordsShorten(`${v.headline}. ${v.subheadline}`, MESSAGE_LIMITS.whatsapp),
  };
}

/** Garante que toda variante tenha textos de canal (usa a reserva quando faltam). */
export function withMessages<T extends CopyVariant>(v: T): T & { messages: ChannelMessages } {
  return { ...v, messages: v.messages ?? defaultMessages(v) };
}

/** Aplica as regras de texto aos textos de canal de uma variante. */
export function validateMessages(m: ChannelMessages, products: Product[], cfg: RulesConfig = DEFAULT_RULES_CONFIG): RuleResult[] {
  const out: RuleResult[] = [];
  const authorized = new Set(products.flatMap((p) => p.claims.map(normalize)));
  for (const f of MESSAGE_FIELDS) {
    const text = m[f] ?? '';
    const id = `msg:${f}`;
    const label = MESSAGE_LABELS[f];
    if (COMMERCIAL_IN_TEXT.test(text)) out.push(ruleResult('COM-004', false, `${label}: valor ou condição comercial em texto livre. O preço entra pelo cadastro.`, id));
    for (const term of cfg.forbiddenTerms) if (termIn(text, term)) out.push(ruleResult('MAR-004', false, `${label}: termo proibido "${term}".`, id));
    for (const term of cfg.claimTerms)
      if (termIn(text, term, true) && ![...authorized].some((c) => c.includes(normalize(term))))
        out.push(ruleResult('REG-003', false, `${label}: alegação "${term}" fora das autorizadas.`, id));
    if (text.length > MESSAGE_LIMITS[f]) out.push(ruleResult('FMT-005', false, `${label}: ${text.length} caracteres (máx. ${MESSAGE_LIMITS[f]}).`, id));
    const excl = (text.match(/!/g) ?? []).length;
    if (excl > cfg.maxExclamations) out.push(ruleResult('MAR-005', false, `${label}: ${excl} exclamações.`, id));
  }
  return out;
}

export interface ComposedMessages {
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  emailPreheader: string;
  /** Mensagem completa com bloco de ofertas, vigência, advertência e link. */
  whatsapp: string;
  /** Linhas de oferta usadas (para conferência). */
  offerLines: string[];
  /** Produtos sem oferta válida na praça (ficam fora do bloco de ofertas). */
  missing: string[];
}

/** Monta os textos finais de uma praça: texto criativo + dados do cadastro. Nunca inventa preço. */
export function composeMessages(m: ChannelMessages, ctx: RenderContext, skus: string[], link: string): ComposedMessages {
  const offerLines: string[] = [];
  const missing: string[] = [];
  let hasMip = false;
  for (const sku of skus) {
    const p = ctx.products[sku];
    const o = ctx.offers[sku];
    if (!p) continue;
    if (p.category === 'rx') continue;
    if (!o || o.status !== 'ativa' || o.endsAt < ctx.today) {
      missing.push(p.name);
      continue;
    }
    if (p.category === 'mip') hasMip = true;
    const de = o.listPriceCents && o.listPriceCents > o.priceCents ? `de ${formatBRL(o.listPriceCents)} ` : '';
    offerLines.push(`• ${p.name}: ${de}por ${formatBRL(o.priceCents)}`);
  }
  const offered = skus.filter((s) => offerLines.length && ctx.offers[s]);
  const parts = [m.whatsapp];
  if (offerLines.length) parts.push(offerLines.join('\n'), validityText(ctx, offered));
  if (hasMip) parts.push(ctx.legal.mipWarning);
  parts.push(link);
  return {
    pushTitle: m.pushTitle,
    pushBody: m.pushBody,
    emailSubject: m.emailSubject,
    emailPreheader: m.emailPreheader,
    whatsapp: parts.join('\n\n'),
    offerLines,
    missing,
  };
}
