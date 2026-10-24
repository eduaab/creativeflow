import { COLOR_TOKEN_NAMES, hex } from './brand/brand';
import { contrastRatio } from './color';
import { FORMATS, type CreativeDoc, type Layer, type LayerRole, type RenderContext, type Segment } from './domain';
import { resolveLayerText } from './format';
import { estimateTextHeight } from './text';

/**
 * MOTOR DE REGRAS — código determinístico, independente da IA.
 * A IA nunca decide se uma peça pode sair: estas funções decidem.
 */

export type Severity = 'info' | 'alerta' | 'critico';
export type RuleCategory = 'comercial' | 'marca' | 'formato' | 'regulatorio';

export interface RuleDefinition {
  id: string;
  category: RuleCategory;
  title: string;
  severity: Severity;
  description: string;
}

export interface RuleResult {
  ruleId: string;
  category: RuleCategory;
  title: string;
  severity: Severity;
  passed: boolean;
  message: string;
  layerId?: string;
}

export interface ValidationReport {
  results: RuleResult[];
  counts: Record<Severity, number>;
  /** true = nenhum resultado crítico. */
  passed: boolean;
  checkedAt: string;
  rulesVersion: string;
}

export interface RulesConfig {
  version: string;
  forbiddenTerms: string[];
  claimTerms: string[];
  mipWarning: string;
  contrastMin: number;
  contrastMinLarge: number;
  logoMinWidthRatio: number;
  maxExclamations: number;
  blockRx: boolean;
}

export const DEFAULT_RULES_CONFIG: RulesConfig = {
  version: 'regras-2026.10-v1',
  forbiddenTerms: [
    'milagre',
    'milagroso',
    'cura',
    'curar',
    'garantido',
    'garantia de resultado',
    '100% eficaz',
    '100% seguro',
    'sem efeitos colaterais',
    'sem contraindicação',
    'o mais barato',
    'melhor preço do brasil',
  ],
  claimTerms: ['previne', 'prevenir', 'combate', 'trata', 'tratamento', 'elimina', 'imunidade', 'emagrec', 'recomendado por médicos', 'clinicamente comprovado'],
  mipWarning: 'SE PERSISTIREM OS SINTOMAS, O MÉDICO DEVERÁ SER CONSULTADO.',
  contrastMin: 4.5,
  contrastMinLarge: 3,
  logoMinWidthRatio: 0.1,
  maxExclamations: 1,
  blockRx: true,
};

export const RULES: RuleDefinition[] = [
  { id: 'COM-001', category: 'comercial', title: 'Oferta cadastrada para a praça', severity: 'critico', description: 'Todo produto com preço precisa de oferta cadastrada para a praça da peça. O sistema nunca preenche um preço alternativo.' },
  { id: 'COM-002', category: 'comercial', title: 'Oferta ativa hoje', severity: 'critico', description: 'A oferta precisa estar ativa e dentro da vigência na data de referência. Revalidado também na exportação.' },
  { id: 'COM-003', category: 'comercial', title: 'Vigência cobre a campanha', severity: 'critico', description: 'O período da oferta precisa cobrir o período da campanha.' },
  { id: 'COM-004', category: 'comercial', title: 'Sem preço ou condição em texto livre', severity: 'critico', description: 'Valores, percentuais e condições comerciais só podem aparecer pelas camadas vinculadas ao cadastro.' },
  { id: 'COM-005', category: 'comercial', title: 'Preço vinculado ao cadastro', severity: 'critico', description: 'Cada produto da peça tem uma camada de preço ligada à oferta.' },
  { id: 'COM-006', category: 'comercial', title: 'Oferta pertence à praça da peça', severity: 'critico', description: 'Impede que o preço de uma praça saia na peça de outra.' },
  { id: 'COM-007', category: 'comercial', title: 'Imagem autorizada do produto', severity: 'alerta', description: 'Sem imagem autorizada, a peça usa um placeholder identificado — nunca uma embalagem inventada.' },
  { id: 'MAR-001', category: 'marca', title: 'Logo presente e legível', severity: 'critico', description: 'Logo obrigatório e com largura mínima.' },
  { id: 'MAR-002', category: 'marca', title: 'Cores da paleta', severity: 'critico', description: 'Somente tokens de cor do manual de marca.' },
  { id: 'MAR-003', category: 'marca', title: 'Tamanho mínimo de texto', severity: 'alerta', description: 'Texto pequeno demais para o formato.' },
  { id: 'MAR-004', category: 'marca', title: 'Termos proibidos', severity: 'critico', description: 'Termos vetados pelo manual de marca (promessas, superlativos absolutos).' },
  { id: 'MAR-005', category: 'marca', title: 'Tom de voz', severity: 'info', description: 'Excesso de exclamações ou caixa alta.' },
  { id: 'FMT-001', category: 'formato', title: 'Dimensões do formato', severity: 'critico', description: 'Dimensões exatas do canal.' },
  { id: 'FMT-002', category: 'formato', title: 'Área segura', severity: 'alerta', description: 'Elementos importantes dentro da área segura do canal.' },
  { id: 'FMT-003', category: 'formato', title: 'Sem sobreposição', severity: 'alerta', description: 'Textos, preço e produto não se sobrepõem.' },
  { id: 'FMT-004', category: 'formato', title: 'Contraste legível', severity: 'alerta', description: 'Contraste WCAG mínimo entre texto e fundo.' },
  { id: 'FMT-005', category: 'formato', title: 'Limite de caracteres', severity: 'alerta', description: 'Título e subtítulo dentro do limite do formato.' },
  { id: 'FMT-006', category: 'formato', title: 'Texto cabe na caixa', severity: 'alerta', description: 'Estimativa de quebra de linha não estoura a caixa.' },
  { id: 'REG-001', category: 'regulatorio', title: 'Medicamento sob prescrição', severity: 'critico', description: 'Comunicação ao público geral de medicamento sob prescrição não é suportada pela plataforma.' },
  { id: 'REG-002', category: 'regulatorio', title: 'Advertência de MIP', severity: 'critico', description: 'Peças com medicamento isento de prescrição exibem a advertência configurada.' },
  { id: 'REG-003', category: 'regulatorio', title: 'Alegações de saúde autorizadas', severity: 'alerta', description: 'Alegações fora da lista autorizada do produto exigem revisão especializada.' },
  { id: 'REG-004', category: 'regulatorio', title: 'Medicamento e público infantil', severity: 'alerta', description: 'Comunicação de medicamento para público que envolve crianças exige revisão especializada.' },
];

const DEF = new Map(RULES.map((r) => [r.id, r]));

/** Monta um resultado de regra a partir do catálogo (usado também pelos textos de canal). */
export function ruleResult(ruleId: string, passed: boolean, message: string, layerId?: string, severity?: Severity): RuleResult {
  const d = DEF.get(ruleId)!;
  return { ruleId, category: d.category, title: d.title, severity: severity ?? d.severity, passed, message, layerId };
}

const CONTENT_ROLES: LayerRole[] = ['headline', 'subheadline', 'cta', 'price', 'product-name', 'validity', 'legal', 'logo', 'badge', 'extra-text', 'product-image'];
const CRITICAL_IF_OUTSIDE: LayerRole[] = ['price', 'legal', 'logo', 'validity'];
export const COMMERCIAL_IN_TEXT = /(r\$\s?\d)|(\d+[.,]\d{2}\b)|(\d{1,3}\s?%)|(\bgr[aá]tis\b)|(\bleve\s+\d+\s+pague\s+\d+\b)|(\bpor apenas\b)|(\bdesconto de\b)|(\bfrete gr[aá]tis\b)/i;

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function termIn(text: string, term: string, prefix = false): boolean {
  const t = normalize(text);
  const n = normalize(term);
  if (n.includes(' ') || n.includes('%')) return t.includes(n);
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}${prefix ? '' : '($|[^a-z0-9])'}`, 'i').test(t);
}

function intersect(a: Layer, b: Layer): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function contains(shape: Layer, px: number, py: number): boolean {
  if (shape.style.shape === 'circle') {
    const r = Math.min(shape.w, shape.h) / 2;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  }
  return px >= shape.x && px <= shape.x + shape.w && py >= shape.y && py <= shape.y + shape.h;
}

/** Cor efetivamente atrás do centro do texto (camadas inferiores ou fundo). */
export function colorBehind(doc: CreativeDoc, layer: Layer): string {
  if (layer.style.bg) return layer.style.bg;
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  const below = doc.layers
    .filter((l) => !l.hidden && l.z < layer.z && (l.kind === 'shape' || (l.kind === 'text' && l.style.bg)))
    .sort((a, b) => b.z - a.z);
  for (const l of below) {
    if (contains(l, cx, cy)) return l.kind === 'shape' ? (l.style.fill ?? 'white') : (l.style.bg as string);
  }
  return doc.background;
}

export interface ValidateOptions {
  config?: RulesConfig;
  segment?: Segment;
}

export function validateCreative(doc: CreativeDoc, ctx: RenderContext, opts: ValidateOptions = {}): ValidationReport {
  const cfg = opts.config ?? DEFAULT_RULES_CONFIG;
  const results: RuleResult[] = [];
  const spec = FORMATS[doc.format];
  const W = doc.width;
  const H = doc.height;
  const base = Math.max(Math.min(W, H) / 1080, 0.75);
  const visible = doc.layers.filter((l) => !l.hidden);
  const creativeText = visible.filter((l) => l.kind === 'text' && !l.binding && l.text);

  const add = (ruleId: string, passed: boolean, message: string, layerId?: string, severity?: Severity) => {
    const d = DEF.get(ruleId)!;
    results.push({ ruleId, category: d.category, title: d.title, severity: severity ?? d.severity, passed, message, layerId });
  };

  /* ---------- Comercial ---------- */
  const priceLayers = visible.filter((l) => l.kind === 'price-tag');
  for (const sku of doc.meta.skus) {
    const offer = ctx.offers[sku];
    const product = ctx.products[sku];
    const label = product?.name ?? sku;
    const priceLayer = priceLayers.find((l) => l.binding?.sku === sku);

    if (!offer) {
      add('COM-001', false, `Não há oferta cadastrada para "${label}" em ${ctx.praca.name}. Nenhum preço alternativo foi preenchido.`, priceLayer?.id);
    } else {
      add('COM-001', true, `Oferta ${offer.id} encontrada para "${label}".`);
      const activeToday = offer.status === 'ativa' && offer.startsAt <= ctx.today && offer.endsAt >= ctx.today;
      add('COM-002', activeToday, activeToday ? `Oferta vigente em ${ctx.today}.` : `Oferta de "${label}" ${offer.status !== 'ativa' ? 'está inativa' : `fora da vigência em ${ctx.today} (${offer.startsAt} a ${offer.endsAt})`}.`, priceLayer?.id);
      const covers = offer.startsAt <= ctx.campaign.startsAt && offer.endsAt >= ctx.campaign.endsAt;
      add('COM-003', covers, covers ? 'Vigência da oferta cobre a campanha.' : `Oferta de "${label}" vale de ${offer.startsAt} a ${offer.endsAt}, mas a campanha vai de ${ctx.campaign.startsAt} a ${ctx.campaign.endsAt}. Cadastre nova oferta.`, priceLayer?.id);
      const samePraca = offer.praca === doc.meta.praca && ctx.praca.code === doc.meta.praca;
      add('COM-006', samePraca, samePraca ? `Oferta da praça ${doc.meta.praca}.` : `Oferta da praça ${offer.praca} usada em peça de ${doc.meta.praca}.`, priceLayer?.id);
    }
    add('COM-005', !!priceLayer && priceLayer.binding?.source === 'offer', priceLayer ? 'Preço vinculado à oferta cadastrada.' : `"${label}" está sem camada de preço vinculada.`, priceLayer?.id);
    if (product) {
      const hasImg = product.image.type !== 'none';
      add('COM-007', hasImg, hasImg ? 'Imagem do produto autorizada.' : `"${label}" sem imagem autorizada; usando placeholder identificado.`);
    }
  }
  let freeTextCommercial = false;
  for (const l of creativeText) {
    if (COMMERCIAL_IN_TEXT.test(l.text!)) {
      freeTextCommercial = true;
      add('COM-004', false, `Texto livre contém valor ou condição comercial: "${l.text}". Use as camadas vinculadas ao cadastro.`, l.id);
    }
  }
  if (!freeTextCommercial) add('COM-004', true, 'Nenhum valor comercial digitado em texto livre.');

  /* ---------- Marca ---------- */
  const logo = visible.find((l) => l.role === 'logo');
  if (!logo) add('MAR-001', false, 'Peça sem logo.');
  else {
    const minW = W * (spec.orientation === 'wide' ? cfg.logoMinWidthRatio * 0.8 : cfg.logoMinWidthRatio);
    add('MAR-001', logo.w >= minW, logo.w >= minW ? 'Logo presente.' : `Logo com ${logo.w}px de largura; mínimo ${Math.round(minW)}px.`, logo.id, logo.w >= minW ? undefined : 'alerta');
  }
  const badColors = visible.flatMap((l) =>
    (['color', 'bg', 'fill'] as const)
      .map((k) => l.style[k])
      .filter((c) => c !== undefined && !COLOR_TOKEN_NAMES.includes(c as never))
      .map((c) => ({ l, c })),
  );
  if (!COLOR_TOKEN_NAMES.includes(doc.background as never)) badColors.push({ l: doc.layers[0], c: doc.background });
  if (badColors.length) badColors.forEach(({ l, c }) => add('MAR-002', false, `Cor "${c}" fora da paleta.`, l?.id));
  else add('MAR-002', true, 'Todas as cores pertencem à paleta.');

  const minFont = 13 * base;
  const tiny = visible.filter((l) => l.kind === 'text' && (l.style.fontSize ?? 24) < minFont);
  if (tiny.length) tiny.forEach((l) => add('MAR-003', false, `Texto com ${l.style.fontSize}px (mínimo ${Math.round(minFont)}px).`, l.id));
  else add('MAR-003', true, 'Tamanhos de texto legíveis.');

  let forbiddenFound = false;
  for (const l of creativeText) {
    for (const term of cfg.forbiddenTerms) {
      if (termIn(l.text!, term)) {
        forbiddenFound = true;
        add('MAR-004', false, `Termo proibido pelo manual: "${term}".`, l.id);
      }
    }
  }
  if (!forbiddenFound) add('MAR-004', true, 'Nenhum termo proibido.');

  const allCreative = creativeText.map((l) => l.text!).join(' ');
  const excl = (allCreative.match(/!/g) ?? []).length;
  const words = allCreative.split(/\s+/).filter((w) => w.length > 3);
  const caps = words.filter((w) => w === w.toUpperCase() && /[A-ZÀ-Ú]/.test(w)).length;
  const toneOk = excl <= cfg.maxExclamations && (words.length === 0 || caps / words.length < 0.5);
  add('MAR-005', toneOk, toneOk ? 'Tom de voz dentro do manual.' : `Tom fora do manual: ${excl} exclamação(ões), ${caps} palavra(s) em caixa alta.`);

  /* ---------- Formato ---------- */
  const dimOk = W === spec.width && H === spec.height;
  add('FMT-001', dimOk, dimOk ? `${W}×${H}px (${spec.label}).` : `Peça com ${W}×${H}px; esperado ${spec.width}×${spec.height}px.`);

  const content = visible.filter((l) => CONTENT_ROLES.includes(l.role));
  let safeOk = true;
  for (const l of content) {
    const outside = l.x < 0 || l.y < 0 || l.x + l.w > W || l.y + l.h > H;
    if (outside) {
      safeOk = false;
      add('FMT-002', false, `"${l.id}" sai dos limites da peça.`, l.id, CRITICAL_IF_OUTSIDE.includes(l.role) ? 'critico' : 'alerta');
      continue;
    }
    const s = spec.safe;
    const inSafe = l.x >= s.left - 1 && l.y >= s.top - 1 && l.x + l.w <= W - s.right + 1 && l.y + l.h <= H - s.bottom + 1;
    if (!inSafe && l.role !== 'product-image') {
      safeOk = false;
      add('FMT-002', false, `"${l.id}" está fora da área segura de ${spec.label}.`, l.id);
    }
  }
  if (safeOk) add('FMT-002', true, 'Elementos dentro da área segura.');

  let overlapOk = true;
  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i];
      const b = content[j];
      const area = intersect(a, b);
      const smaller = Math.min(a.w * a.h, b.w * b.h);
      if (area > smaller * 0.03) {
        overlapOk = false;
        add('FMT-003', false, `"${a.id}" e "${b.id}" estão sobrepostos.`, b.id);
      }
    }
  }
  if (overlapOk) add('FMT-003', true, 'Sem sobreposição entre elementos.');

  let contrastOk = true;
  for (const l of visible.filter((x) => x.kind === 'text' || x.kind === 'price-tag')) {
    const fg = hex(l.style.color);
    const bgToken = colorBehind(doc, l);
    const ratio = contrastRatio(fg, hex(bgToken, 'white'));
    const fs = l.kind === 'price-tag' ? 999 : (l.style.fontSize ?? 24);
    const large = fs >= 42 * base || ((l.style.fontWeight ?? 400) >= 700 && fs >= 32 * base);
    const min = large ? cfg.contrastMinLarge : cfg.contrastMin;
    if (ratio < min) {
      contrastOk = false;
      add('FMT-004', false, `Contraste ${ratio.toFixed(2)}:1 em "${l.id}" (mínimo ${min}:1).`, l.id);
    }
  }
  if (contrastOk) add('FMT-004', true, 'Contraste adequado em todos os textos.');

  const hl = visible.find((l) => l.role === 'headline');
  const sub = visible.find((l) => l.role === 'subheadline');
  const lenIssues: string[] = [];
  if (hl?.text && hl.text.length > spec.maxHeadline) lenIssues.push(`título com ${hl.text.length} caracteres (máx. ${spec.maxHeadline})`);
  if (sub?.text && sub.text.length > spec.maxSubheadline) lenIssues.push(`subtítulo com ${sub.text.length} caracteres (máx. ${spec.maxSubheadline})`);
  add('FMT-005', lenIssues.length === 0, lenIssues.length ? `Texto longo para ${spec.label}: ${lenIssues.join('; ')}.` : 'Textos dentro do limite do formato.', lenIssues.length ? hl?.id : undefined);

  let fitOk = true;
  for (const l of visible.filter((x) => x.kind === 'text')) {
    const text = resolveLayerText(l, ctx);
    const pad = (l.style.bg ? 0.84 : 1) * l.w;
    const h = estimateTextHeight(text, l.style.fontSize ?? 24, pad, l.style.font ?? 'body', l.style.fontWeight ?? 400, l.style.lineHeight ?? 1.15, !!l.style.uppercase);
    if (h > l.h * 1.08) {
      fitOk = false;
      add('FMT-006', false, `Texto de "${l.id}" pode não caber na caixa (≈${Math.round(h)}px para ${l.h}px).`, l.id);
    }
  }
  if (fitOk) add('FMT-006', true, 'Textos cabem nas caixas.');

  /* ---------- Regulatório ---------- */
  const products = doc.meta.skus.map((s) => ctx.products[s]).filter(Boolean);
  const rx = products.filter((p) => p.category === 'rx');
  if (cfg.blockRx && rx.length) rx.forEach((p) => add('REG-001', false, `"${p.name}" é medicamento sob prescrição. A plataforma bloqueia esse caso.`));
  else add('REG-001', true, 'Sem medicamento sob prescrição.');

  const mip = products.filter((p) => p.category === 'mip');
  if (mip.length) {
    const legal = visible.find((l) => l.role === 'legal' && l.binding?.field === 'mipWarning');
    const ok = !!legal && (legal.style.fontSize ?? 0) >= 14 * base && legal.x >= 0 && legal.y + legal.h <= H;
    add('REG-002', ok, ok ? 'Advertência de MIP presente.' : 'Peça com medicamento isento de prescrição sem a advertência obrigatória visível.', legal?.id);
  } else add('REG-002', true, 'Sem medicamento isento de prescrição.');

  const authorized = new Set(products.flatMap((p) => p.claims.map(normalize)));
  let claimOk = true;
  for (const l of creativeText) {
    for (const term of cfg.claimTerms) {
      if (termIn(l.text!, term, true) && ![...authorized].some((c) => c.includes(normalize(term)))) {
        claimOk = false;
        add('REG-003', false, `Alegação "${term}" não consta nas alegações autorizadas. Encaminhar para revisão especializada.`, l.id);
      }
    }
  }
  if (claimOk) add('REG-003', true, 'Alegações dentro do autorizado.');

  const drugs = products.filter((p) => p.category === 'mip' || p.category === 'rx');
  const childOk = !(drugs.length && opts.segment?.involvesChildren);
  add('REG-004', childOk, childOk ? 'Público compatível.' : `Medicamento comunicado para "${opts.segment?.name}". Exige revisão especializada.`);

  const counts: Record<Severity, number> = { info: 0, alerta: 0, critico: 0 };
  for (const r of results) if (!r.passed) counts[r.severity]++;
  return { results, counts, passed: counts.critico === 0, checkedAt: new Date().toISOString(), rulesVersion: cfg.version };
}
