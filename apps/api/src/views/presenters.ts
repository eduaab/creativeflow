import type { Offer, Praca, Product, RulesConfig } from '@cf/shared';
import type { CampaignRow, ConceptRow } from '../models/campaign.model';
import type { CreativeRow, VersionRow } from '../models/creative.model';

/**
 * VIEWS (camada de apresentação da API): definem o formato JSON entregue ao front-end.
 * Mantêm controllers enxutos e escondem detalhes de persistência.
 */
export function presentVersion(v: VersionRow, opts: { withDoc?: boolean } = { withDoc: true }) {
  return {
    id: v.id,
    number: v.number,
    origin: v.origin,
    conceptId: v.conceptId,
    authorId: v.authorId,
    instruction: v.instruction,
    status: v.status,
    createdAt: v.createdAt,
    diff: v.diff ?? [],
    rejected: v.rejected ?? [],
    validation: v.validation,
    doc: opts.withDoc ? v.doc : undefined,
  };
}

export function presentCreative(c: CreativeRow, v?: VersionRow) {
  return {
    id: c.id,
    campaignId: c.campaignId,
    format: c.format,
    praca: c.praca,
    segmentId: c.segmentId,
    skus: c.skus,
    status: c.status,
    exceptionReason: c.exceptionReason,
    updatedAt: c.updatedAt,
    current: v ? presentVersion(v) : null,
  };
}

export function presentConcept(c: ConceptRow | undefined) {
  return c ?? null;
}

export function presentCampaign(c: CampaignRow) {
  return { id: c.id, name: c.name, briefing: c.briefing, createdBy: c.createdBy, createdAt: c.createdAt, updatedAt: c.updatedAt, firstExportAt: c.firstExportAt };
}

/** Dados comerciais/legal para o front montar o RenderContext de cada peça. */
export function presentContextBundle(p: {
  products: Record<string, Product>;
  offersByPraca: Record<string, Record<string, Offer | undefined>>;
  pracas: Praca[];
  today: string;
  rules: RulesConfig;
  campaign: CampaignRow;
}) {
  return {
    products: p.products,
    offersByPraca: p.offersByPraca,
    pracas: p.pracas,
    today: p.today,
    legal: { mipWarning: p.rules.mipWarning },
    campaign: { startsAt: p.campaign.briefing.startsAt, endsAt: p.campaign.briefing.endsAt, name: p.campaign.name },
  };
}
