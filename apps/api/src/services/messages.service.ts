import { composeMessages, validateMessages, withMessages, type ComposedMessages, type RuleResult } from '@cf/shared';
import { getCampaign, getCurrentConcept, type CampaignRow, type ConceptRow } from '../models/campaign.model';
import { getProducts } from '../models/catalog.model';
import { badRequest, notFound } from '../utils/errors';
import { buildContextFor } from './context.service';
import { getRulesConfig } from './settings.service';

export interface ChannelMessagesRow {
  praca: string;
  segmentId: string;
  composed: ComposedMessages;
}

/** Problemas de regra nos textos de canal de cada público (independe da praça). */
export async function messageIssues(campaign: CampaignRow, concept: ConceptRow): Promise<Record<string, RuleResult[]>> {
  const [products, rules] = await Promise.all([getProducts(campaign.briefing.skus), getRulesConfig()]);
  const list = Object.values(products);
  return Object.fromEntries(concept.data.variants.map((v) => [v.segmentId, validateMessages(withMessages(v).messages, list, rules)]));
}

/** Textos finais por praça × público, com preço e vigência vindos do cadastro. */
export async function composeCampaignMessages(campaign: CampaignRow, concept: ConceptRow): Promise<ChannelMessagesRow[]> {
  const b = campaign.briefing;
  const rows: ChannelMessagesRow[] = [];
  for (const praca of b.pracas) {
    const ctx = await buildContextFor(praca, b.skus, campaign);
    for (const v of concept.data.variants) {
      rows.push({ praca, segmentId: v.segmentId, composed: composeMessages(withMessages(v).messages, ctx, b.skus, b.ctaUrl) });
    }
  }
  return rows;
}

export async function getCampaignMessages(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const concept = await getCurrentConcept(campaignId);
  if (!concept) throw badRequest('Gere o conceito antes de ver os textos por canal.');
  const [issues, rows] = await Promise.all([messageIssues(campaign, concept), composeCampaignMessages(campaign, concept)]);
  return { conceptId: concept.id, issues, rows };
}
