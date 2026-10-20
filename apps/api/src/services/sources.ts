import type { Offer, Product } from '@cf/shared';
import { getOffersFor, getProducts } from '../models/catalog.model';

/**
 * PONTOS DE INTEGRAÇÃO (interfaces substituíveis)
 *
 * Hoje cada interface lê a base sintética no banco. Para ligar aos sistemas reais,
 * implemente a mesma interface com o conector corporativo (ERP, PIM/catálogo,
 * motor de preços, DAM) e troque a instância exportada abaixo. Nenhuma outra parte
 * do sistema precisa mudar — regras, templates e IA consomem só estas interfaces.
 */
export interface CatalogSource {
  getProducts(skus: string[]): Promise<Record<string, Product>>;
}
export interface OfferSource {
  /** Oferta candidata por SKU para a praça; as regras decidem se é válida. */
  getOffers(praca: string, skus: string[]): Promise<Record<string, Offer | undefined>>;
}
export interface PublishTarget {
  /** Destino dos arquivos aprovados (DAM, SharePoint, pasta de rede…). */
  name: string;
  deliver(files: { name: string; data: Buffer }[], meta: Record<string, unknown>): Promise<{ location: string }>;
}

export const catalogSource: CatalogSource = { getProducts };
export const offerSource: OfferSource = { getOffers: getOffersFor };
