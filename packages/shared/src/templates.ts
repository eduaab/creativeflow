import { BRAND_VERSION, type ColorToken } from './brand/brand';
import {
  FORMATS,
  type BackgroundStyle,
  type CopyVariant,
  type CreativeDoc,
  type FormatId,
  type Layer,
  type LayoutFamily,
  type Orientation,
  type Product,
} from './domain';
import { fitFontSize, wordsShorten } from './text';

type Box = [number, number, number, number];
type Slot =
  | 'logo'
  | 'badge'
  | 'headline'
  | 'subheadline'
  | 'cta'
  | 'product'
  | 'name'
  | 'price'
  | 'legal'
  | 'validity';

/**
 * Biblioteca de templates. Cada família define caixas relativas (0–1) por orientação.
 * O designer mantém estes layouts; a IA só escolhe a família e escreve os textos.
 */
export const LAYOUTS: Record<Exclude<Orientation, 'sheet'>, Record<LayoutFamily, Record<Slot, Box>>> = {
  square: {
    classico: {
      logo: [0.06, 0.05, 0.24, 0.055],
      badge: [0.7, 0.05, 0.24, 0.06],
      headline: [0.06, 0.16, 0.47, 0.27],
      subheadline: [0.06, 0.45, 0.45, 0.13],
      cta: [0.06, 0.62, 0.32, 0.075],
      product: [0.53, 0.14, 0.42, 0.56],
      name: [0.53, 0.72, 0.42, 0.05],
      price: [0.06, 0.735, 0.38, 0.135],
      legal: [0.06, 0.885, 0.88, 0.04],
      validity: [0.06, 0.925, 0.88, 0.045],
    },
    destaque: {
      logo: [0.38, 0.045, 0.24, 0.055],
      badge: [0.72, 0.05, 0.22, 0.055],
      headline: [0.08, 0.12, 0.84, 0.13],
      subheadline: [0.12, 0.255, 0.76, 0.06],
      product: [0.28, 0.33, 0.44, 0.37],
      name: [0.2, 0.705, 0.6, 0.045],
      price: [0.3, 0.76, 0.4, 0.11],
      cta: [0.72, 0.785, 0.22, 0.065],
      legal: [0.06, 0.885, 0.88, 0.035],
      validity: [0.06, 0.925, 0.88, 0.045],
    },
  },
  portrait: {
    classico: {
      logo: [0.06, 0.04, 0.24, 0.045],
      badge: [0.7, 0.04, 0.24, 0.05],
      headline: [0.06, 0.12, 0.88, 0.17],
      subheadline: [0.06, 0.3, 0.88, 0.07],
      price: [0.06, 0.43, 0.36, 0.13],
      cta: [0.06, 0.6, 0.32, 0.06],
      product: [0.44, 0.39, 0.5, 0.38],
      name: [0.44, 0.775, 0.5, 0.04],
      legal: [0.06, 0.86, 0.88, 0.03],
      validity: [0.06, 0.9, 0.88, 0.05],
    },
    destaque: {
      logo: [0.38, 0.035, 0.24, 0.045],
      badge: [0.72, 0.04, 0.22, 0.045],
      headline: [0.08, 0.1, 0.84, 0.12],
      subheadline: [0.12, 0.225, 0.76, 0.05],
      product: [0.24, 0.29, 0.52, 0.39],
      name: [0.15, 0.69, 0.7, 0.04],
      price: [0.29, 0.745, 0.42, 0.1],
      cta: [0.34, 0.855, 0.32, 0.045],
      legal: [0.06, 0.91, 0.88, 0.025],
      validity: [0.06, 0.935, 0.88, 0.04],
    },
  },
  tall: {
    classico: {
      logo: [0.07, 0.135, 0.26, 0.035],
      badge: [0.66, 0.137, 0.27, 0.032],
      headline: [0.07, 0.19, 0.86, 0.12],
      subheadline: [0.07, 0.315, 0.86, 0.05],
      product: [0.2, 0.375, 0.6, 0.245],
      name: [0.15, 0.625, 0.7, 0.028],
      price: [0.24, 0.655, 0.52, 0.08],
      cta: [0.3, 0.745, 0.4, 0.033],
      legal: [0.07, 0.782, 0.86, 0.016],
      validity: [0.07, 0.8, 0.86, 0.02],
    },
    destaque: {
      logo: [0.37, 0.135, 0.26, 0.035],
      badge: [0.66, 0.137, 0.27, 0.032],
      product: [0.12, 0.185, 0.76, 0.3],
      name: [0.15, 0.49, 0.7, 0.028],
      headline: [0.07, 0.53, 0.86, 0.1],
      subheadline: [0.1, 0.635, 0.8, 0.04],
      price: [0.24, 0.68, 0.52, 0.068],
      cta: [0.3, 0.752, 0.4, 0.03],
      legal: [0.07, 0.786, 0.86, 0.014],
      validity: [0.07, 0.802, 0.86, 0.018],
    },
  },
  wide: {
    classico: {
      logo: [0.025, 0.07, 0.12, 0.13],
      headline: [0.025, 0.26, 0.4, 0.36],
      subheadline: [0.025, 0.63, 0.38, 0.14],
      cta: [0.025, 0.8, 0.15, 0.13],
      product: [0.45, 0.06, 0.22, 0.8],
      name: [0.45, 0.87, 0.22, 0.08],
      badge: [0.7, 0.07, 0.18, 0.12],
      price: [0.7, 0.24, 0.2, 0.36],
      legal: [0.7, 0.64, 0.27, 0.1],
      validity: [0.7, 0.76, 0.27, 0.17],
    },
    destaque: {
      product: [0.03, 0.04, 0.25, 0.82],
      name: [0.03, 0.875, 0.25, 0.08],
      logo: [0.85, 0.07, 0.12, 0.13],
      badge: [0.7, 0.08, 0.13, 0.11],
      headline: [0.31, 0.12, 0.37, 0.38],
      subheadline: [0.31, 0.53, 0.37, 0.15],
      cta: [0.31, 0.74, 0.15, 0.14],
      price: [0.71, 0.27, 0.22, 0.38],
      legal: [0.47, 0.76, 0.22, 0.1],
      validity: [0.71, 0.7, 0.26, 0.22],
    },
  },
};

export interface BuildInput {
  format: FormatId;
  family: LayoutFamily;
  backgroundStyle: BackgroundStyle;
  variant: CopyVariant;
  encarteHeadline: string;
  skus: string[];
  products: Record<string, Product>;
  praca: string;
  segmentId: string;
}

const px = (b: Box, W: number, H: number) => ({
  x: Math.round(b[0] * W),
  y: Math.round(b[1] * H),
  w: Math.round(b[2] * W),
  h: Math.round(b[3] * H),
});

export function needsMipWarning(skus: string[], products: Record<string, Product>): boolean {
  return skus.some((s) => products[s]?.category === 'mip');
}

/** Constrói a peça derivada (determinística) a partir do conceito + dados estruturados. */
export function buildCreativeDoc(input: BuildInput): CreativeDoc {
  const spec = FORMATS[input.format];
  if (spec.orientation === 'sheet') return buildEncarte(input);

  const W = spec.width;
  const H = spec.height;
  const L = LAYOUTS[spec.orientation][input.family];
  const b = Math.max(Math.min(W, H) / 1080, 0.75);
  const center = input.family === 'destaque';
  const sku = input.skus[0];
  const layers: Layer[] = [];
  let z = 10;

  const headlineText =
    input.variant.headline.length > spec.maxHeadline
      ? input.variant.shortHeadline
      : input.variant.headline;
  const subText = wordsShorten(input.variant.subheadline, spec.maxSubheadline);

  const product = px(L.product, W, H);
  layers.push(...decorLayers(input.backgroundStyle, product, W, H, input.family));

  const lg = px(L.logo, W, H);
  layers.push({ id: 'logo', role: 'logo', kind: 'logo', ...lg, z: z++, style: {} });

  if (input.variant.badge) {
    const bx = px(L.badge, W, H);
    layers.push({
      id: 'badge',
      role: 'badge',
      kind: 'text',
      ...bx,
      z: z++,
      text: input.variant.badge,
      style: {
        font: 'display',
        fontWeight: 600,
        fontSize: fitFontSize(input.variant.badge, { w: bx.w * 0.84, h: bx.h * 0.56 }, { min: 12 * b, max: bx.h * 0.5, font: 'display', weight: 600 }),
        color: 'ink',
        bg: 'sun',
        radius: Math.round(bx.h / 2),
        align: 'center',
        valign: 'middle',
      },
    });
  }

  const hl = px(L.headline, W, H);
  layers.push({
    id: 'headline',
    role: 'headline',
    kind: 'text',
    ...hl,
    z: z++,
    text: headlineText,
    style: {
      font: 'display',
      fontWeight: 700,
      lineHeight: 1.08,
      color: 'primaryDark',
      align: center ? 'center' : 'left',
      valign: center ? 'middle' : 'bottom',
      fontSize: fitFontSize(headlineText, hl, { min: 34 * b, max: Math.min(hl.h * 0.62, 120 * b), font: 'display', weight: 700, lineHeight: 1.08 }),
    },
  });

  const sb = px(L.subheadline, W, H);
  layers.push({
    id: 'subheadline',
    role: 'subheadline',
    kind: 'text',
    ...sb,
    z: z++,
    text: subText,
    style: {
      font: 'body',
      fontWeight: 500,
      lineHeight: 1.25,
      color: 'muted',
      align: center ? 'center' : 'left',
      valign: 'top',
      fontSize: fitFontSize(subText, sb, { min: 20 * b, max: Math.min(sb.h * 0.5, 44 * b), font: 'body', weight: 500, lineHeight: 1.25 }),
    },
  });

  const ct = px(L.cta, W, H);
  layers.push({
    id: 'cta',
    role: 'cta',
    kind: 'text',
    ...ct,
    z: z++,
    text: input.variant.cta,
    style: {
      font: 'display',
      fontWeight: 600,
      color: 'white',
      bg: 'primary',
      radius: Math.round(ct.h / 2),
      align: 'center',
      valign: 'middle',
      fontSize: fitFontSize(input.variant.cta, { w: ct.w * 0.84, h: ct.h * 0.5 }, { min: 15 * b, max: ct.h * 0.42, font: 'display', weight: 600 }),
    },
  });

  layers.push({
    id: 'product-image',
    role: 'product-image',
    kind: 'image',
    ...product,
    z: z++,
    binding: { source: 'product', sku, field: 'image' },
    style: {},
  });

  const nm = px(L.name, W, H);
  const pname = input.products[sku]?.name ?? '';
  layers.push({
    id: 'product-name',
    role: 'product-name',
    kind: 'text',
    ...nm,
    z: z++,
    binding: { source: 'product', sku, field: 'name' },
    style: {
      font: 'body',
      fontWeight: 600,
      color: 'ink',
      align: center || spec.orientation === 'tall' ? 'center' : 'left',
      valign: 'middle',
      lineHeight: 1.15,
      fontSize: fitFontSize(pname, nm, { min: 16 * b, max: nm.h * 0.62, font: 'body', weight: 600 }),
    },
  });

  const pr = px(L.price, W, H);
  layers.push({
    id: 'price',
    role: 'price',
    kind: 'price-tag',
    ...pr,
    z: z++,
    binding: { source: 'offer', sku, field: 'price' },
    style: { color: 'white', bg: 'accent', radius: Math.round(Math.min(pr.h, pr.w) * 0.16) },
  });

  if (needsMipWarning(input.skus, input.products)) {
    const le = px(L.legal, W, H);
    layers.push({
      id: 'legal',
      role: 'legal',
      kind: 'text',
      ...le,
      z: z++,
      binding: { source: 'legal', field: 'mipWarning' },
      style: {
        font: 'body',
        fontWeight: 700,
        color: 'ink',
        uppercase: true,
        align: 'left',
        valign: 'middle',
        fontSize: Math.max(15 * b, Math.round(le.h * 0.42)),
      },
    });
  }

  const vd = px(L.validity, W, H);
  layers.push({
    id: 'validity',
    role: 'validity',
    kind: 'text',
    ...vd,
    z: z++,
    binding: { source: 'offer', sku, field: 'validity' },
    style: {
      font: 'body',
      fontWeight: 400,
      color: 'muted',
      align: 'left',
      valign: 'middle',
      lineHeight: 1.2,
      fontSize: Math.max(15 * b, Math.round(Math.min(vd.h * 0.36, 22 * b))),
    },
  });

  return {
    format: input.format,
    width: W,
    height: H,
    background: input.backgroundStyle === 'solido' ? 'light' : 'white',
    layers,
    meta: {
      family: input.family,
      backgroundStyle: input.backgroundStyle,
      praca: input.praca,
      segmentId: input.segmentId,
      skus: [sku],
      brandVersion: BRAND_VERSION,
    },
  };
}

function decorLayers(
  style: BackgroundStyle,
  product: { x: number; y: number; w: number; h: number },
  W: number,
  H: number,
  family: LayoutFamily,
): Layer[] {
  if (style === 'solido') return [];
  if (style === 'circulos') {
    const d = Math.round(Math.max(product.w, product.h) * 1.02);
    const cx = product.x + product.w / 2;
    const cy = product.y + product.h / 2;
    const small = Math.round(Math.min(W, H) * 0.32);
    return [
      {
        id: 'decor-1',
        role: 'decor',
        kind: 'shape',
        x: Math.round(cx - d / 2),
        y: Math.round(cy - d / 2),
        w: d,
        h: d,
        z: 1,
        style: { shape: 'circle', fill: 'primarySoft' },
      },
      {
        id: 'decor-2',
        role: 'decor',
        kind: 'shape',
        x: Math.round(W - small * 0.55),
        y: Math.round(H - small * 0.6),
        w: small,
        h: small,
        z: 2,
        style: { shape: 'circle', fill: 'accentSoft' },
      },
    ];
  }
  // blocos: bloco lateral quando o produto está de um lado; faixa inferior quando está centralizado
  if (family === 'classico' && product.x > W * 0.35) {
    const x = Math.round(product.x - W * 0.03);
    return [
      { id: 'decor-1', role: 'decor', kind: 'shape', x, y: 0, w: W - x, h: H, z: 1, style: { shape: 'rect', fill: 'primarySoft' } },
      {
        id: 'decor-2',
        role: 'decor',
        kind: 'shape',
        x,
        y: 0,
        w: Math.round(Math.min(W, H) * 0.018),
        h: H,
        z: 2,
        style: { shape: 'rect', fill: 'sun' },
      },
    ];
  }
  const y = Math.round(product.y + product.h * 0.45);
  return [
    { id: 'decor-1', role: 'decor', kind: 'shape', x: 0, y, w: W, h: H - y, z: 1, style: { shape: 'rect', fill: 'primarySoft' } },
  ];
}

/* ------------------------------------------------------------------ */
/* Encarte: página com várias ofertas da mesma praça                   */
/* ------------------------------------------------------------------ */

function buildEncarte(input: BuildInput): CreativeDoc {
  const spec = FORMATS.encarte;
  const W = spec.width;
  const H = spec.height;
  const layers: Layer[] = [];
  const skus = input.skus.slice(0, 6);
  let z = 10;

  layers.push({ id: 'decor-header', role: 'decor', kind: 'shape', x: 0, y: 0, w: W, h: 300, z: 1, style: { shape: 'rect', fill: 'primary' } });
  layers.push({ id: 'decor-stripe', role: 'decor', kind: 'shape', x: 0, y: 300, w: W, h: 14, z: 2, style: { shape: 'rect', fill: 'sun' } });
  layers.push({ id: 'logo', role: 'logo', kind: 'logo', x: 40, y: 40, w: 300, h: 70, z: z++, style: { fill: 'white' } });
  layers.push({
    id: 'cta',
    role: 'cta',
    kind: 'text',
    x: 860,
    y: 44,
    w: 340,
    h: 64,
    z: z++,
    text: input.variant.cta,
    style: { font: 'display', fontWeight: 600, color: 'ink', bg: 'sun', radius: 32, align: 'center', valign: 'middle', fontSize: 28 },
  });
  layers.push({
    id: 'headline',
    role: 'headline',
    kind: 'text',
    x: 40,
    y: 135,
    w: 1160,
    h: 140,
    z: z++,
    text: input.encarteHeadline,
    style: {
      font: 'display',
      fontWeight: 700,
      color: 'white',
      lineHeight: 1.05,
      align: 'left',
      valign: 'middle',
      fontSize: fitFontSize(input.encarteHeadline, { w: 1160, h: 140 }, { min: 44, max: 84, font: 'display', weight: 700, lineHeight: 1.05 }),
    },
  });

  const top = 350;
  const bottom = 1560;
  const gap = 30;
  const cols = 2;
  const rows = 3;
  const cw = (W - 80 - gap) / cols;
  const ch = (bottom - top - gap * (rows - 1)) / rows;

  skus.forEach((sku, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = Math.round(40 + col * (cw + gap));
    const y = Math.round(top + row * (ch + gap));
    const p = `s${i + 1}`;
    const name = input.products[sku]?.name ?? '';
    layers.push({ id: `${p}-card`, role: 'card', kind: 'shape', x, y, w: Math.round(cw), h: Math.round(ch), z: 3, style: { shape: 'rect', fill: 'white', radius: 28 } });
    layers.push({ id: `${p}-image`, role: 'product-image', kind: 'image', x: x + 18, y: y + 24, w: 220, h: Math.round(ch - 48), z: z++, binding: { source: 'product', sku, field: 'image' }, style: {} });
    layers.push({
      id: `${p}-name`,
      role: 'product-name',
      kind: 'text',
      x: x + 255,
      y: y + 36,
      w: Math.round(cw - 280),
      h: 130,
      z: z++,
      binding: { source: 'product', sku, field: 'name' },
      style: { font: 'body', fontWeight: 600, color: 'ink', lineHeight: 1.15, valign: 'top', fontSize: fitFontSize(name, { w: cw - 280, h: 130 }, { min: 22, max: 34, font: 'body', weight: 600 }) },
    });
    layers.push({ id: `${p}-price`, role: 'price', kind: 'price-tag', x: x + 255, y: Math.round(y + ch - 190), w: Math.round(cw - 280), h: 160, z: z++, binding: { source: 'offer', sku, field: 'price' }, style: { color: 'white', bg: 'accent', radius: 24 } });
  });

  if (needsMipWarning(skus, input.products)) {
    layers.push({
      id: 'legal',
      role: 'legal',
      kind: 'text',
      x: 40,
      y: 1585,
      w: 1160,
      h: 44,
      z: z++,
      binding: { source: 'legal', field: 'mipWarning' },
      style: { font: 'body', fontWeight: 700, color: 'ink', uppercase: true, valign: 'middle', fontSize: 20 },
    });
  }
  layers.push({
    id: 'validity',
    role: 'validity',
    kind: 'text',
    x: 40,
    y: 1640,
    w: 1160,
    h: 80,
    z: z++,
    binding: { source: 'offer', field: 'validity' },
    style: { font: 'body', fontWeight: 400, color: 'muted', lineHeight: 1.25, valign: 'middle', fontSize: 22 },
  });

  return {
    format: 'encarte',
    width: W,
    height: H,
    background: 'light',
    layers,
    meta: {
      family: input.family,
      backgroundStyle: input.backgroundStyle,
      praca: input.praca,
      segmentId: input.segmentId,
      skus,
      brandVersion: BRAND_VERSION,
    },
  };
}

export const PALETTE_FOR_EDITOR: ColorToken[] = [
  'primary',
  'primaryDark',
  'primarySoft',
  'accent',
  'accentSoft',
  'sun',
  'ink',
  'muted',
  'light',
  'white',
];
