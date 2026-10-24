import { BRAND_VERSION, FORMATS, STATUS_LABELS, canExport, formatBRL, slugify } from '@cf/shared';
import JSZip from 'jszip';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { env } from '../config/env';
import { getCampaign, getCurrentConcept, markFirstExport } from '../models/campaign.model';
import { composeCampaignMessages } from './messages.service';
import { getCurrentVersions, listCreatives } from '../models/creative.model';
import { audit, insertExport, listReviewsForCreative } from '../models/governance.model';
import { getUser } from '../models/user.model';
import { badRequest, notFound } from '../utils/errors';
import { newId } from '../utils/id';
import { renderPng } from './render.service';
import { evaluateVersion } from './validation.service';

export const ExportSchema = z.object({
  creativeIds: z.array(z.string()).optional(),
  pracas: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
});

/**
 * Exportação com GATE no servidor: revalida cada peça com os dados comerciais de agora.
 * Se a oferta venceu durante a revisão, a peça perde a liberação e fica fora do pacote.
 */
export async function exportCampaign(campaignId: string, raw: unknown, userId: string) {
  const body = ExportSchema.parse(raw ?? {});
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  let creatives = await listCreatives(campaignId);
  if (body.creativeIds?.length) creatives = creatives.filter((c) => body.creativeIds!.includes(c.id));
  if (body.pracas?.length) creatives = creatives.filter((c) => body.pracas!.includes(c.praca));
  if (body.formats?.length) creatives = creatives.filter((c) => body.formats!.includes(c.format));
  const versions = await getCurrentVersions(creatives.map((c) => c.id));
  const slug = slugify(campaign.name).slice(0, 40);
  const zip = new JSZip();
  const items: Record<string, unknown>[] = [];
  const blocked: { creativeId: string; file: string; status: string; reason: string }[] = [];
  const csv: string[] = ['arquivo;praca;formato;publico;versao;status;aprovado_por;oferta;preco;vigencia'];
  let rulesVersion = '';
  const users = new Map<string, string>();
  const userName = async (id: string) => {
    if (!users.has(id)) users.set(id, (await getUser(id))?.name ?? id);
    return users.get(id)!;
  };

  for (const c of creatives) {
    const v = versions[c.id];
    if (!v) continue;
    const skuPart = c.skus.length > 1 ? 'multi' : c.skus[0].replace('SKU-', '');
    const file = `${c.praca}/${c.format}/${slug}_${c.praca}_${c.format}_${c.segmentId}_${skuPart}_v${v.number}.png`;
    const ev = await evaluateVersion(c, v, campaign);
    rulesVersion = ev.report.rulesVersion;
    const gate = canExport(ev.status, ev.report);
    if (!gate.ok) {
      blocked.push({ creativeId: c.id, file, status: STATUS_LABELS[ev.status], reason: gate.reason! });
      continue;
    }
    const png = await renderPng(v.doc, ev.ctx);
    zip.file(file, png);
    const review = (await listReviewsForCreative(c.id)).find((r) => r.versionId === v.id && r.decision === 'aprovado');
    const approvedBy = review ? await userName(review.reviewerId) : 'herança do conceito';
    const offers = c.skus.map((s) => ev.ctx.offers[s]).filter(Boolean);
    items.push({
      file,
      creativeId: c.id,
      versionId: v.id,
      version: v.number,
      origin: v.origin,
      format: FORMATS[c.format].label,
      praca: c.praca,
      segment: c.segmentId,
      status: ev.status,
      approvedBy,
      offers: offers.map((o) => ({ id: o!.id, sku: o!.sku, price: formatBRL(o!.priceCents), startsAt: o!.startsAt, endsAt: o!.endsAt })),
      validation: ev.report.counts,
    });
    csv.push([file, c.praca, c.format, c.segmentId, `v${v.number}`, STATUS_LABELS[ev.status], approvedBy, offers.map((o) => o!.id).join('|'), offers.map((o) => formatBRL(o!.priceCents)).join('|'), offers.map((o) => `${o!.startsAt}..${o!.endsAt}`).join('|')].join(';'));
  }

  const exportId = newId('exp');
  if (!items.length) {
    await audit({ campaignId, actorId: userId, type: 'export.blocked', payload: { blocked: blocked.length } });
    throw badRequest('Nenhuma peça liberada para exportação. Somente versões aprovadas e sem bloqueio crítico podem ser exportadas.', { blocked });
  }
  const manifest = {
    exportId,
    campaign: { id: campaign.id, name: campaign.name, period: `${campaign.briefing.startsAt}..${campaign.briefing.endsAt}` },
    exportedAt: new Date().toISOString(),
    exportedBy: await userName(userId),
    brandVersion: BRAND_VERSION,
    rulesVersion,
    items,
    blocked,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('relatorio.csv', '﻿' + csv.join('\n'));
  // Textos por canal: só praças com ao menos uma peça liberada; conceito precisa estar aprovado.
  const concept = await getCurrentConcept(campaignId);
  let channelTexts = 0;
  if (concept?.status === 'aprovado') {
    const releasedPracas = new Set(items.map((i) => String(i.praca)));
    const rows = (await composeCampaignMessages(campaign, concept)).filter((r) => releasedPracas.has(r.praca));
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ['praca;publico;canal;texto;ofertas_fora'];
    for (const r of rows) {
      const c = r.composed;
      const fora = c.missing.join(' | ');
      for (const [canal, texto] of [['push_titulo', c.pushTitle], ['push_texto', c.pushBody], ['email_assunto', c.emailSubject], ['email_preheader', c.emailPreheader], ['whatsapp', c.whatsapp]] as const)
        lines.push([r.praca, r.segmentId, canal, q(texto), q(fora)].join(';'));
      zip.file(`${r.praca}/textos/${r.segmentId}_whatsapp.txt`, c.whatsapp);
      channelTexts++;
    }
    if (rows.length) zip.file('textos-canais.csv', '﻿' + lines.join('\n'));
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const dir = join(env.dataDir, 'exports', campaignId);
  mkdirSync(dir, { recursive: true });
  const fileName = `${slug}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.zip`;
  const path = join(dir, `${exportId}.zip`);
  writeFileSync(path, buf);
  await insertExport({ id: exportId, campaignId, fileName, path, count: items.length, manifest, createdBy: userId });
  await markFirstExport(campaignId);
  await audit({ campaignId, actorId: userId, type: 'export.done', payload: { exportId, count: items.length, blocked: blocked.length, fileName, channelTexts } });
  return { exportId, fileName, count: items.length, blocked, channelTexts };
}
