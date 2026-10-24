import type { CreativeDoc, RenderContext, Segment } from '@cf/shared';
import { getPraca, listSegments } from '../models/catalog.model';
import type { CampaignRow } from '../models/campaign.model';
import { notFound } from '../utils/errors';
import { getRulesConfig, getToday } from './settings.service';
import { catalogSource, offerSource } from './sources';

/** Monta o contexto com dados comerciais SEMPRE frescos da fonte (nunca do documento). */
export async function buildContext(doc: CreativeDoc, campaign: CampaignRow): Promise<RenderContext> {
  return buildContextFor(doc.meta.praca, doc.meta.skus, campaign);
}

/** Contexto comercial de uma praça (produtos, ofertas vigentes, advertência), sem precisar de peça. */
export async function buildContextFor(pracaCode: string, skus: string[], campaign: CampaignRow): Promise<RenderContext> {
  const [products, offers, praca, today, rules] = await Promise.all([
    catalogSource.getProducts(skus),
    offerSource.getOffers(pracaCode, skus),
    getPraca(pracaCode),
    getToday(),
    getRulesConfig(),
  ]);
  if (!praca) throw notFound(`Praça ${pracaCode}`);
  return {
    products,
    offers,
    praca,
    campaign: { startsAt: campaign.briefing.startsAt, endsAt: campaign.briefing.endsAt, name: campaign.name },
    today,
    legal: { mipWarning: rules.mipWarning },
  };
}

let segCache: { at: number; list: Segment[] } | null = null;
export async function getSegment(id: string): Promise<Segment | undefined> {
  if (!segCache || Date.now() - segCache.at > 10_000) segCache = { at: Date.now(), list: await listSegments() };
  return segCache.list.find((s) => s.id === id);
}
