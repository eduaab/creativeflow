import type { RenderContext } from '@cf/shared';
import type { ContextBundle } from '../api/client';

/** Contexto de renderização montado com dados comerciais vindos do servidor (fonte de ofertas). */
export function ctxFor(bundle: ContextBundle, praca: string, skus: string[]): RenderContext {
  const offers = bundle.offersByPraca[praca] ?? {};
  return {
    products: bundle.products,
    offers: Object.fromEntries(skus.map((s) => [s, offers[s]])),
    praca: bundle.pracas.find((p) => p.code === praca) ?? { code: praca, name: praca },
    campaign: bundle.campaign,
    today: bundle.today,
    legal: bundle.legal,
  };
}
