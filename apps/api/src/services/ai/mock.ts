import {
  FORMATS,
  colorBehind,
  contrastRatio,
  fitFontSize,
  hex,
  MESSAGE_LIMITS,
  wordsShorten,
  type ChannelMessages,
  type SemanticCategory,
  type Concept,
  type CopyVariant,
  type CreativeDoc,
  type Layer,
} from '@cf/shared';
import type { AIProvider, ConceptInput, Critique, CritiqueInput, EditInput, EditResult, SemanticInput, SemanticResult } from './types';

/**
 * Provedor determinístico. Permite desenvolver e demonstrar sem chave de API e serve
 * de contingência se o provedor real falhar. NÃO é apresentado como IA generativa:
 * a interface mostra "modo demonstração" quando ele está ativo.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface ThemeBank {
  match: RegExp;
  theme: string;
  headlines: [string, string][]; // [headline, short]
  subs: string[];
}

const THEMES: ThemeBank[] = [
  {
    match: /autocuidado|cuidado pessoal|self/,
    theme: 'Autocuidado na rotina',
    headlines: [
      ['Seu momento de autocuidado começa aqui', 'Seu momento de autocuidado'],
      ['Cuidado que cabe na sua rotina', 'Cuidado na sua rotina'],
      ['Autocuidado todo dia, do seu jeito', 'Autocuidado todo dia'],
      ['Seu autocuidado com a gente do lado', 'Autocuidado com a gente'],
    ],
    subs: ['Itens para a rotina de cuidados, com a praticidade de comprar pertinho de você.', 'Separe um tempo para você. O resto a gente ajuda a resolver.'],
  },
  {
    match: /verao|sol\b|solar|praia|calor/,
    theme: 'Verão com cuidado',
    headlines: [
      ['Aproveite o sol com mais cuidado', 'Sol com mais cuidado'],
      ['Pele protegida o verão inteiro', 'Pele protegida no verão'],
    ],
    subs: ['Proteção e hidratação para curtir os dias de calor.', 'Tudo para a sua rotina de verão, do protetor ao pós-sol.'],
  },
  {
    match: /inverno|frio/,
    theme: 'Cuidado nos dias frios',
    headlines: [
      ['Pele e cabelo bem cuidados no frio', 'Bem cuidados no frio'],
      ['Seu cuidado para os dias frios', 'Cuidado nos dias frios'],
    ],
    subs: ['Hidratação extra para a rotina das estações mais secas.'],
  },
  {
    match: /volta as aulas|escola|crianc|infantil|bebe|familia/,
    theme: 'Cuidado em família',
    headlines: [
      ['Cuidado para toda a família', 'Cuidado para a família'],
      ['Rotina da família mais leve', 'Rotina mais leve'],
    ],
    subs: ['Praticidade para a rotina da casa, do banho ao dia a dia dos pequenos.'],
  },
  {
    match: /sao joao|junin|carnaval|festa|feriado/,
    theme: 'Festa com cuidado',
    headlines: [
      ['Aproveite a festa com mais cuidado', 'Festa com mais cuidado'],
      ['Curta cada momento com saúde', 'Curta com saúde'],
    ],
    subs: ['Hidratação, proteção e o que mais você precisar para aproveitar bem os dias de festa.'],
  },
  {
    match: /bem.estar|vitamina|saude|energia/,
    theme: 'Bem-estar no dia a dia',
    headlines: [
      ['Bem-estar para o seu dia a dia', 'Bem-estar no dia a dia'],
      ['Sua rotina de bem-estar começa aqui', 'Rotina de bem-estar'],
    ],
    subs: ['Encontre o que você precisa para a rotina, com orientação farmacêutica.'],
  },
];

const DEFAULT_THEME: ThemeBank = {
  match: /.*/,
  theme: 'Cuidado no dia a dia',
  headlines: [
    ['Cuidar de você faz parte do nosso dia', 'Cuidar de você'],
    ['Ofertas para cuidar de você', 'Para cuidar de você'],
    ['Cuidado que cabe na sua rotina', 'Cuidado na sua rotina'],
    ['Tudo para a sua rotina de cuidados', 'Sua rotina de cuidados'],
  ],
  subs: ['Itens selecionados para o seu dia a dia, pertinho de você e no app.'],
};

function pickTheme(text: string): ThemeBank {
  const t = norm(text);
  return THEMES.find((th) => th.match.test(t)) ?? DEFAULT_THEME;
}

function variantFor(segmentId: string, segmentBadge: string | null, base: { headline: string; short: string; sub: string }, cta: string, hasDrug: boolean): CopyVariant {
  const v = baseVariantFor(segmentId, segmentBadge, base, cta, hasDrug);
  return { ...v, messages: mockMessages(v) };
}

/** Textos por canal no modo demonstração: mesmo conceito, adaptado ao tamanho de cada canal. */
function mockMessages(v: CopyVariant): ChannelMessages {
  const club = v.segmentId === 'fidelidade';
  return {
    pushTitle: wordsShorten(v.shortHeadline, MESSAGE_LIMITS.pushTitle),
    pushBody: wordsShorten(`${wordsShorten(v.subheadline, 80)} Veja no app.`, MESSAGE_LIMITS.pushBody),
    emailSubject: wordsShorten(club ? `${v.shortHeadline}: ofertas do Clube` : v.headline, MESSAGE_LIMITS.emailSubject),
    emailPreheader: wordsShorten(v.subheadline, MESSAGE_LIMITS.emailPreheader),
    whatsapp: wordsShorten(`Olá! ${v.headline}. ${v.subheadline} Separamos estas ofertas para você:`, MESSAGE_LIMITS.whatsapp),
  };
}

function baseVariantFor(segmentId: string, segmentBadge: string | null, base: { headline: string; short: string; sub: string }, cta: string, hasDrug: boolean): CopyVariant {
  const sober = hasDrug ? 'Encontre o que precisa para o seu dia a dia, com orientação farmacêutica.' : base.sub;
  switch (segmentId) {
    case 'fidelidade':
      return { segmentId, headline: 'Vantagens do Clube para a sua rotina', shortHeadline: 'Vantagens do Clube', subheadline: `${sober} Identifique-se no caixa ou no app.`, cta, badge: segmentBadge };
    case 'familia':
      return { segmentId, headline: 'Cuidado para toda a família', shortHeadline: 'Cuidado para a família', subheadline: hasDrug ? sober : 'Praticidade para a rotina da casa, do banho ao dia a dia dos pequenos.', cta, badge: segmentBadge };
    case '60mais':
      return { segmentId, headline: 'Cuidar de você, todos os dias', shortHeadline: 'Cuidar de você todo dia', subheadline: hasDrug ? sober : 'Produtos para a sua rotina, com a atenção de sempre.', cta, badge: segmentBadge };
    default:
      return { segmentId, headline: base.headline, shortHeadline: base.short, subheadline: sober, cta, badge: segmentBadge };
  }
}

function generateConcept(i: ConceptInput): Concept {
  const key = `${i.briefing.name} ${i.briefing.objective}`;
  const theme = pickTheme(key);
  const prevIdx = i.previous ? theme.headlines.findIndex(([h]) => h === i.previous!.variants[0]?.headline) : -1;
  const idx = prevIdx >= 0 ? (prevIdx + 1) % theme.headlines.length : hash(key) % theme.headlines.length;
  const [headline, short] = theme.headlines[idx];
  const sub = theme.subs[(idx + (i.feedback ? 1 : 0)) % theme.subs.length];
  const hasDrug = i.products.some((p) => p.category === 'mip' || p.category === 'rx');
  const cta = (i.briefing.ctaLabel || 'Compre no app').slice(0, 24);
  const family = i.briefing.layoutFamily !== 'auto' ? i.briefing.layoutFamily : i.products.length === 1 ? (['destaque', 'faixa'] as const)[hash(key) % 2] : (['classico', 'faixa'] as const)[hash(key) % 2];
  const bgs = ['circulos', 'blocos', 'solido'] as const;
  const backgroundStyle = bgs[(hash(key) + (i.previous ? 1 : 0)) % 3];
  const segs = i.briefing.segments.map((id) => i.segments.find((s) => s.id === id)).filter(Boolean);
  return {
    theme: theme.theme,
    rationale: `Conceito "${theme.theme}" derivado do objetivo "${i.briefing.objective}". Um mesmo título-base adaptado para ${segs.length} público(s), sem citar preço ou condição (inseridos pelo cadastro). Layout "${family}" para ${family === 'faixa' ? 'dar força ao tema com a faixa de cor da marca' : i.products.length === 1 ? 'dar destaque ao produto único' : 'equilibrar texto e produto'}.${i.feedback ? ` Ajustado ao feedback: "${i.feedback}".` : ''}`,
    layoutFamily: family,
    backgroundStyle,
    encarteHeadline: i.briefing.name.length <= 40 ? i.briefing.name : short,
    variants: segs.map((s) => variantFor(s!.id, s!.badge, { headline, short, sub }, cta, hasDrug)),
  };
}

/* ------------------------------------------------------------------ */

const COLOR_WORDS: [RegExp, string][] = [
  [/laranja/, 'accent'],
  [/amarel/, 'sun'],
  [/verde|azul|petroleo/, 'primary'],
  [/escur/, 'primaryDark'],
  [/preto/, 'ink'],
  [/branc/, 'white'],
];

function clampBox(l: Layer, W: number, H: number, safe: { top: number; right: number; bottom: number; left: number }) {
  const x = Math.min(Math.max(l.x, safe.left), W - safe.right - l.w);
  const y = Math.min(Math.max(l.y, safe.top), H - safe.bottom - l.h);
  return { x: Math.round(x), y: Math.round(y) };
}

function interpretEdit(i: EditInput): EditResult {
  const t = norm(i.instruction);
  const doc = i.doc;
  const spec = FORMATS[doc.format];
  const L = (id: string) => doc.layers.find((l) => l.id === id);
  const ops: EditResult['ops'] = [];
  const notes: string[] = [];

  if (/\b(publique|publicar|publica|postar|poste|aprove|aprovar|aprova)\b|sem aprovacao|pul(e|ar) a revisao/.test(t)) {
    return { summary: 'Pedido recusado.', ops: [], refusal: { category: 'processo', message: 'Publicação e aprovação não são feitas pela IA. Envie a peça para revisão; a exportação é liberada após aprovação.' } };
  }
  const hasValue = /(r\$|\d+[.,]\d{2}|\d+\s?%|desconto|gratis|leve \d)/.test(t);
  const priceLayout = /preco.{0,25}(maior|destaq|aument|menor|diminu)|(aument|destaq|diminu|reduz).{0,20}preco/.test(t);
  const priceChange = !priceLayout && /(preco|valor|vigencia|validade|oferta)/.test(t) && /(mud|alter|troc|coloq|bot|abaix|baix|para r|escrev|corrij|atualiz)/.test(t);
  const productChange = /(nome do produto|troque o produto por|outro produto|outra embalagem|mude a imagem do produto|outra imagem)/.test(t);
  if (hasValue || priceChange || productChange) {
    return {
      summary: 'Pedido recusado.',
      ops: [],
      refusal: { category: 'dado_comercial', message: 'Preço, desconto, vigência e dados do produto vêm do cadastro de ofertas e ficam travados. Para corrigir, atualize a oferta na fonte com autorização; a peça será revalidada.' },
    };
  }

  const headline = L('headline');
  const sub = L('subheadline');
  const product = L('product-image');
  const cta = L('cta');

  const priceLayer = doc.layers.find((l) => l.role === 'price');
  if (priceLayer && priceLayout && !hasValue) {
    const k = /(menor|diminu|reduz)/.test(t) ? 0.88 : 1.12;
    const nw = Math.round(priceLayer.w * k);
    const nh = Math.round(priceLayer.h * k);
    ops.push({ op: 'set', layerId: priceLayer.id, path: 'w', value: nw }, { op: 'set', layerId: priceLayer.id, path: 'h', value: nh }, { op: 'set', layerId: priceLayer.id, path: 'x', value: Math.round(priceLayer.x - (nw - priceLayer.w) / 2) });
    notes.push(`Etiqueta de preço ${k > 1 ? 'ampliada' : 'reduzida'} (apenas tamanho; o valor continua vindo da oferta).`);
  }

  const quoted = i.instruction.match(/["“']([^"”']{3,80})["”']/)?.[1];
  if (quoted && headline && /t[ií]tulo|titulo/.test(t)) {
    ops.push({ op: 'set', layerId: 'headline', path: 'text', value: quoted });
    notes.push(`Título trocado para "${quoted}".`);
  } else if (quoted && cta && /(cta|botao|chamada)/.test(t)) {
    ops.push({ op: 'set', layerId: 'cta', path: 'text', value: quoted.slice(0, 24) });
    notes.push(`CTA trocado para "${quoted.slice(0, 24)}".`);
  }

  const wantsShortTitle = /(encurt|reduz|diminu|resum|enxug).{0,25}titulo|titulo.{0,20}(curto|menor|enxuto)/.test(t);
  const wantsObjective = /(mais objetiv|mais diret|mais curt|mais enxut)/.test(t);
  if (headline && (wantsShortTitle || wantsObjective) && !quoted) {
    const current = headline.text ?? '';
    let next = i.variant?.shortHeadline && i.variant.shortHeadline.length < current.length ? i.variant.shortHeadline : wordsShorten(current, Math.max(12, Math.ceil(current.length * 0.6)));
    if (next === current) next = wordsShorten(current, Math.max(10, current.length - 8));
    ops.push({ op: 'set', layerId: 'headline', path: 'text', value: next });
    const fs = fitFontSize(next, headline, { min: 30, max: Math.min(headline.h * 0.62, (headline.style.fontSize ?? 60) * 1.25), font: 'display', weight: 700, lineHeight: headline.style.lineHeight ?? 1.08 });
    ops.push({ op: 'set', layerId: 'headline', path: 'style.fontSize', value: fs });
    notes.push(`Título encurtado para "${next}" e fonte reajustada para ${fs}px.`);
  }
  if (sub && wantsObjective) {
    const next = wordsShorten(sub.text ?? '', Math.max(24, Math.ceil((sub.text ?? '').length * 0.6)));
    ops.push({ op: 'set', layerId: 'subheadline', path: 'text', value: next });
    notes.push('Subtítulo mais direto.');
  }

  if (headline && /(aument|maior|cresc).{0,20}titulo|titulo.{0,15}maior/.test(t) && !wantsShortTitle) {
    const fs = Math.round((headline.style.fontSize ?? 60) * 1.15);
    ops.push({ op: 'set', layerId: 'headline', path: 'style.fontSize', value: fs });
    notes.push(`Fonte do título aumentada para ${fs}px.`);
  }

  if (product && /(aument|destaq|maior|cresc|realce).{0,25}produto|produto.{0,20}(maior|destaque|em evidencia)/.test(t)) {
    // procura a maior ampliação (até 25%) que não sobreponha outros elementos de conteúdo
    const name = L('product-name');
    const others = doc.layers.filter((l) => !l.hidden && !['decor', 'card', 'product-image', 'product-name'].includes(l.role));
    const hits = (b: { x: number; y: number; w: number; h: number }, list: Layer[]) =>
      list.some((o) => Math.max(0, Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x)) * Math.max(0, Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y)) > Math.min(b.w * b.h, o.w * o.h) * 0.01);
    const inside = (b: { x: number; y: number; w: number; h: number }) => b.x >= 0 && b.y >= spec.safe.top && b.x + b.w <= doc.width && b.y + b.h <= doc.height - spec.safe.bottom;
    let chosen: { k: number; box: { x: number; y: number; w: number; h: number }; nameY?: number } | null = null;
    for (let k = 1.25; k >= 1.06; k -= 0.03) {
      const w = Math.round(product.w * k);
      const h = Math.round(product.h * k);
      const xs = [product.x - (w - product.w) / 2, product.x, product.x - (w - product.w)];
      for (const [bx, dy] of xs.flatMap((x) => [0, -0.5, 0.5, -1, 1].map((d) => [x, d] as const))) {
        const box = { x: Math.round(bx), y: Math.round(product.y - (h - product.h) / 2 + dy * (h - product.h) / 2), w, h };
        if (!inside(box) || hits(box, others)) continue;
        if (name) {
          const nameBox = { ...name, y: box.y + box.h + 6 };
          if (inside(nameBox) && !hits(nameBox, others)) {
            chosen = { k, box, nameY: nameBox.y };
            break;
          }
          if (!hits(box, [name])) {
            chosen = { k, box };
            break;
          }
        } else {
          chosen = { k, box };
          break;
        }
      }
      if (chosen) break;
    }
    if (chosen) {
      const { box } = chosen;
      ops.push({ op: 'set', layerId: 'product-image', path: 'w', value: box.w }, { op: 'set', layerId: 'product-image', path: 'h', value: box.h }, { op: 'set', layerId: 'product-image', path: 'x', value: box.x }, { op: 'set', layerId: 'product-image', path: 'y', value: box.y });
      if (chosen.nameY !== undefined && name) ops.push({ op: 'set', layerId: 'product-name', path: 'y', value: chosen.nameY });
      const deco = L('decor-1');
      if (deco && deco.style.shape === 'circle') {
        const dd = Math.round(Math.max(box.w, box.h) * 1.02);
        ops.push({ op: 'set', layerId: 'decor-1', path: 'w', value: dd }, { op: 'set', layerId: 'decor-1', path: 'h', value: dd }, { op: 'set', layerId: 'decor-1', path: 'x', value: Math.round(box.x + box.w / 2 - dd / 2) }, { op: 'set', layerId: 'decor-1', path: 'y', value: Math.round(box.y + box.h / 2 - dd / 2) });
      }
      notes.push(`Produto ampliado em ${Math.round((chosen.k - 1) * 100)}% sem sobrepor texto, preço ou selo; a oferta continua intacta.`);
    } else {
      notes.push('Não há espaço para ampliar o produto sem sobrepor outros elementos neste layout.');
    }
  }
  if (product && /(diminu|reduz|menor).{0,20}produto/.test(t)) {
    const k = 0.85;
    const nw = Math.round(product.w * k);
    const nh = Math.round(product.h * k);
    ops.push({ op: 'set', layerId: 'product-image', path: 'w', value: nw }, { op: 'set', layerId: 'product-image', path: 'h', value: nh }, { op: 'set', layerId: 'product-image', path: 'x', value: Math.round(product.x + (product.w - nw) / 2) }, { op: 'set', layerId: 'product-image', path: 'y', value: Math.round(product.y + (product.h - nh) / 2) });
    notes.push('Produto reduzido em 15%.');
  }

  if (cta && /(cta|botao|chamada).{0,30}(maior|espaco|destaq|aument)|(mais espaco|destaque).{0,20}(cta|botao|chamada)/.test(t)) {
    const nw = Math.min(Math.round(cta.w * 1.15), doc.width - spec.safe.right - cta.x);
    const nh = Math.round(cta.h * 1.1);
    ops.push({ op: 'set', layerId: 'cta', path: 'w', value: nw }, { op: 'set', layerId: 'cta', path: 'h', value: nh }, { op: 'set', layerId: 'cta', path: 'style.fontSize', value: Math.round((cta.style.fontSize ?? 28) * 1.08) });
    notes.push('CTA com mais área e fonte maior.');
  }

  if (/centraliz/.test(t)) {
    for (const id of ['headline', 'subheadline']) if (L(id)) ops.push({ op: 'set', layerId: id, path: 'style.align', value: 'center' });
    notes.push('Título e subtítulo centralizados.');
  }

  const colorHit = COLOR_WORDS.find(([re]) => re.test(t));
  if (colorHit && /(cor|colorid|em )/.test(t)) {
    const [, token] = colorHit;
    if (/titulo/.test(t) && headline) {
      ops.push({ op: 'set', layerId: 'headline', path: 'style.color', value: token });
      notes.push(`Cor do título alterada para o token "${token}".`);
    } else if (/(cta|botao)/.test(t) && cta) {
      ops.push({ op: 'set', layerId: 'cta', path: 'style.bg', value: token });
      notes.push(`Fundo do CTA alterado para o token "${token}".`);
    } else if (/fundo|ornamento|circulo|bloco/.test(t) && L('decor-1')) {
      ops.push({ op: 'set', layerId: 'decor-1', path: 'style.fill', value: token });
      notes.push(`Ornamento de fundo alterado para o token "${token}".`);
    }
  }

  if (/(troqu|invert|espelh).{0,40}(produto|imagem|lado)/.test(t) && doc.format !== 'encarte') {
    for (const l of doc.layers) {
      ops.push({ op: 'set', layerId: l.id, path: 'x', value: Math.round(doc.width - l.x - l.w) });
    }
    notes.push('Produto e bloco de texto trocados de lado (espelhamento do layout).');
  }

  if (/(remov|tir|apag).{0,15}selo/.test(t) && L('badge')) {
    ops.push({ op: 'remove', layerId: 'badge' });
    notes.push('Selo removido.');
  }
  if (/(respiro|mais espaco|menos poluid|limp)/.test(t) && sub?.style.fontSize && !ops.some((o) => o.layerId === 'subheadline')) {
    ops.push({ op: 'set', layerId: 'subheadline', path: 'style.fontSize', value: Math.round(sub.style.fontSize * 0.88) });
    notes.push('Subtítulo menor para dar respiro.');
  }

  if (!ops.length) {
    return {
      summary: 'Não identifiquei uma alteração aplicável.',
      ops: [],
      refusal: {
        category: 'nao_entendi',
        message: 'No modo demonstração entendo pedidos como: "encurte o título", "destaque o produto", "dê mais espaço ao CTA", "centralize o título", "título em laranja", "troque o produto de lado", "remova o selo", "mais objetivo", ou título entre aspas.',
      },
    };
  }
  return { summary: notes.join(' '), ops, refusal: null };
}

/* ------------------------------------------------------------------ */

function critique(i: CritiqueInput): Critique {
  const doc: CreativeDoc = i.doc;
  const W = doc.width;
  const H = doc.height;
  const visible = doc.layers.filter((l) => !l.hidden);
  const product = visible.find((l) => l.role === 'product-image');
  const headline = visible.find((l) => l.role === 'headline');
  const texts = visible.filter((l) => l.kind === 'text');
  const productShare = product ? (product.w * product.h) / (W * H) : 0;
  const contentArea = visible.filter((l) => l.role !== 'decor' && l.role !== 'card').reduce((s, l) => s + l.w * l.h, 0) / (W * H);
  const minContrast = Math.min(
    ...texts.map((l) => contrastRatio(hex(l.style.color), hex(colorBehind(doc, l), 'white'))),
  );
  const strengths: string[] = [];
  const issues: Critique['issues'] = [];
  const suggestions: Critique['suggestions'] = [];
  let score = 72;

  if (productShare >= 0.16) {
    strengths.push('Produto com boa presença na composição.');
    score += 6;
  } else if (product && doc.format !== 'encarte') {
    issues.push({ severity: 'media', text: `Produto ocupa ${Math.round(productShare * 100)}% da peça; pode perder força no celular.` });
    suggestions.push({ text: 'Dar mais destaque ao produto.', instruction: 'destaque o produto' });
    score -= 6;
  }
  if (headline?.text && headline.text.length <= FORMATS[doc.format].maxHeadline * 0.8) {
    strengths.push('Título curto, de leitura rápida.');
    score += 5;
  } else if (headline?.text) {
    issues.push({ severity: 'baixa', text: 'Título longo para leitura em rolagem rápida.' });
    suggestions.push({ text: 'Encurtar o título.', instruction: 'encurte o título' });
    score -= 4;
  }
  if (minContrast >= 4.5) {
    strengths.push('Contraste confortável em todos os textos.');
    score += 5;
  } else {
    issues.push({ severity: 'alta', text: `Contraste mínimo de ${minContrast.toFixed(1)}:1 em algum texto.` });
    score -= 10;
  }
  if (contentArea > 0.78) {
    issues.push({ severity: 'media', text: 'Composição densa, com pouco respiro entre os blocos.' });
    suggestions.push({ text: 'Abrir respiro.', instruction: 'deixe a peça com mais respiro' });
    score -= 6;
  } else strengths.push('Hierarquia clara: título, produto e preço bem separados.');
  if (doc.format === 'stories') {
    strengths.push('Conteúdo respeita as áreas reservadas da interface do Stories.');
  }
  if (visible.some((l) => l.role === 'badge')) strengths.push('Selo do público reforça a personalização.');

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    summary: 'Análise heurística (modo demonstração): métricas de composição calculadas sobre as camadas, sem visão computacional.',
    strengths: strengths.slice(0, 5),
    issues,
    suggestions: suggestions.slice(0, 3),
  };
}

/* ------------------------------------------------------------------ */
/* Revisão semântica (modo demonstração): heurísticas transparentes     */
/* ------------------------------------------------------------------ */

const SEMANTIC_PATTERNS: { re: RegExp; category: SemanticCategory; explanation: string; suggestion: string }[] = [
  { re: /\b(adeus|nunca mais|acaba com|acabe com|livre d[aeo]s?|fim d[aeo]s?|100% eficaz|sem dor|elimina|zera)\b/, category: 'alegacao_saude', explanation: 'Sugere resultado de saúde que não está entre as alegações autorizadas.', suggestion: 'Fale do cuidado na rotina, sem prometer resultado.' },
  { re: /\b(metade do preco|menor (preco|valor)|mais barat[oa]|mais em conta|imperdivel|queima de estoque|preco de banana)\b/, category: 'promessa_comercial', explanation: 'Promete vantagem de preço sem vir do cadastro de ofertas.', suggestion: 'Deixe o preço para a etiqueta vinculada à oferta.' },
  { re: /\b(corra|urgente|ultima chance|so hoje|nao perca|acabando)\b/, category: 'tom_de_voz', explanation: 'Pressão de urgência foge do tom acolhedor da marca.', suggestion: 'Convide sem pressionar: "Aproveite com calma no app".' },
  { re: /\b(oxente|arretad[oa]|vixe|cabra da peste|mainha|painho|coisa de mulher|coisa de velho)\b/, category: 'estereotipo', explanation: 'Clichê regional ou de grupo; a personalização deve vir do objetivo.', suggestion: 'Use linguagem neutra e próxima, sem marcar região ou grupo.' },
];
const KID_WORDS = /\b(pequenos?|criancas?|filhos?|bebes?|criancada|baixinhos?)\b/;

function semanticReview(i: SemanticInput): SemanticResult {
  const hasDrug = i.products.some((p) => p.category === 'mip' || p.category === 'rx');
  const findings: SemanticResult['findings'] = [];
  for (const t of i.texts) {
    const n = norm(t.text);
    for (const p of SEMANTIC_PATTERNS) {
      const m = p.re.exec(n);
      if (m) findings.push({ ref: t.ref, category: p.category, excerpt: excerptAt(t.text, m.index, m[0].length), explanation: p.explanation, suggestion: p.suggestion });
    }
    const k = KID_WORDS.exec(n);
    if (hasDrug && k) findings.push({ ref: t.ref, category: 'publico_infantil', excerpt: excerptAt(t.text, k.index, k[0].length), explanation: 'Peça com medicamento usando linguagem dirigida a crianças.', suggestion: 'Fale com o adulto responsável e mantenha o tom informativo.' });
  }
  return { findings };
}

/** Trecho original (com acentos) em volta da posição encontrada no texto normalizado. */
function excerptAt(text: string, idx: number, len: number): string {
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, idx - 12)) + 1);
  const endSpace = text.indexOf(' ', idx + len + 12);
  return text.slice(start, endSpace === -1 ? undefined : endSpace).trim();
}

export const mockProvider: AIProvider = {
  name: 'mock',
  semanticReview: async (i) => semanticReview(i),
  generateConcept: async (i) => generateConcept(i),
  interpretEdit: async (i) => interpretEdit(i),
  critique: async (i) => critique(i),
};
