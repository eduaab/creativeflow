import type { Layer, RenderContext } from './domain';

export function formatBRL(cents: number): string {
  const v = (cents / 100).toFixed(2).replace('.', ',');
  const [int, dec] = v.split(',');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${withDots},${dec}`;
}

export function splitBRL(cents: number): { int: string; dec: string } {
  const s = formatBRL(cents).replace('R$ ', '');
  const [int, dec] = s.split(',');
  return { int, dec };
}

export function formatDateBR(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface ResolvedPrice {
  ok: boolean;
  price?: { int: string; dec: string; full: string };
  listPrice?: string;
  reason?: string;
}

export function resolvePrice(layer: Layer, ctx: RenderContext): ResolvedPrice {
  const sku = layer.binding?.sku;
  if (!sku) return { ok: false, reason: 'Camada de preço sem SKU vinculado' };
  const offer = ctx.offers[sku];
  if (!offer) return { ok: false, reason: `Sem oferta cadastrada para ${sku} em ${ctx.praca.code}` };
  const p = splitBRL(offer.priceCents);
  return {
    ok: true,
    price: { ...p, full: formatBRL(offer.priceCents) },
    listPrice:
      offer.listPriceCents && offer.listPriceCents > offer.priceCents
        ? formatBRL(offer.listPriceCents)
        : undefined,
  };
}

/** Texto final de uma camada: criativo (layer.text) ou resolvido do dado estruturado. */
export function resolveLayerText(layer: Layer, ctx: RenderContext): string {
  if (!layer.binding) return layer.text ?? '';
  const b = layer.binding;
  if (b.source === 'product') {
    const p = b.sku ? ctx.products[b.sku] : undefined;
    if (!p) return '[produto não encontrado]';
    if (b.field === 'name') return p.name;
    if (b.field === 'brand') return p.brand;
    return '';
  }
  if (b.source === 'offer') {
    if (b.field === 'validity') return validityText(ctx, b.sku ? [b.sku] : Object.keys(ctx.offers));
    const r = resolvePrice(layer, ctx);
    return r.ok ? r.price!.full : 'PREÇO INDISPONÍVEL';
  }
  if (b.source === 'legal') {
    if (b.field === 'mipWarning') return ctx.legal.mipWarning;
  }
  return '';
}

export function validityText(ctx: RenderContext, skus: string[]): string {
  const offers = skus.map((s) => ctx.offers[s]).filter(Boolean) as NonNullable<
    RenderContext['offers'][string]
  >[];
  if (!offers.length) return `Ofertas sujeitas a disponibilidade em ${ctx.praca.name}.`;
  const start = offers.map((o) => o.startsAt).sort()[offers.length - 1];
  const end = offers.map((o) => o.endsAt).sort()[0];
  const cond = offers[0].conditions || 'ou enquanto durarem os estoques';
  return `Ofertas válidas de ${formatDateBR(start, false)} a ${formatDateBR(end)} ${cond}, exclusivas para ${ctx.praca.name}. Imagens ilustrativas.`;
}
