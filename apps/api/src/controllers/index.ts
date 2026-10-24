import { BRAND_VERSION, BRAND_VOICE, COLOR_TOKENS, FONT_TOKENS, FORMATS, RULES, SEED_PRACAS } from '@cf/shared';
import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { z } from 'zod';
import { db } from '../db/client';
import { seedDatabase } from '../db/seed';
import { getProducts, listOffers, listPracas, listProducts, listSegments } from '../models/catalog.model';
import { getCampaign, getCurrentConcept, listConcepts } from '../models/campaign.model';
import { getCreative, getCurrentVersions, getVersion, listCreatives, listVersions } from '../models/creative.model';
import {
  getExport,
  insertLearning,
  latestCritique,
  listAudit,
  listExports,
  listLearnings,
  listReviewsForCreative,
  setLearningStatus,
} from '../models/governance.model';
import { getUser, listUsers } from '../models/user.model';
import { aiStatus } from '../services/ai';
import { issueToken } from '../services/auth.service';
import { buildContext } from '../services/context.service';
import { critiqueCreative } from '../services/critique.service';
import { applyAiEdit, discardAiEdit, manualEdit, proposeAiEdit, restoreVersion } from '../services/editing.service';
import { exportCampaign } from '../services/export.service';
import { createCampaign, editConcept, generateConcept, generatePieces, previewBriefing } from '../services/generation.service';
import { importOffers } from '../services/import.service';
import { campaignMetrics, overview } from '../services/metrics.service';
import { renderPng } from '../services/render.service';
import { getCampaignMessages } from '../services/messages.service';
import { dismissFinding, semanticForConcept, semanticForCreative } from '../services/semantic.service';
import { reevaluateCampaign, batchApprove, reviewConcept, reviewCreative, reviewQueue } from '../services/review.service';
import { RulesConfigPatchSchema, getBaseline, getRulesConfig, getToday, setBaseline, setSimulatedToday, updateRulesConfig } from '../services/settings.service';
import { offerSource } from '../services/sources';
import { evaluateCreativeById, evaluateVersion } from '../services/validation.service';
import { badRequest, notFound } from '../utils/errors';
import { presentCampaign, presentContextBundle, presentCreative, presentVersion } from '../views/presenters';
import { audit } from '../models/governance.model';
import { canExport } from '@cf/shared';

const uid = (req: Request) => req.user!.id;
const param = (req: Request, k: string) => String(req.params[k]);

/* ------------------------------ Auth ------------------------------ */
export const AuthController = {
  async users(_req: Request, res: Response) {
    res.json(await listUsers());
  },
  async login(req: Request, res: Response) {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    const user = await getUser(userId);
    if (!user) throw notFound('Usuário');
    res.json({ token: issueToken(user), user });
  },
  async me(req: Request, res: Response) {
    res.json(req.user);
  },
};

/* ----------------------------- Sistema ---------------------------- */
export const SystemController = {
  async status(_req: Request, res: Response) {
    const rules = await getRulesConfig();
    res.json({ ai: aiStatus(), db: db().kind, today: await getToday(), brandVersion: BRAND_VERSION, rulesVersion: rules.version });
  },
  async brand(_req: Request, res: Response) {
    res.json({ version: BRAND_VERSION, colors: COLOR_TOKENS, fonts: FONT_TOKENS, voice: BRAND_VOICE, formats: FORMATS, rules: RULES });
  },
};

/* ----------------------------- Catálogo --------------------------- */
export const CatalogController = {
  async catalog(_req: Request, res: Response) {
    const [products, pracas, segments] = await Promise.all([listProducts(), listPracas(), listSegments()]);
    res.json({ products, pracas, segments });
  },
  async offers(req: Request, res: Response) {
    res.json(await listOffers({ praca: req.query.praca as string | undefined, sku: req.query.sku as string | undefined }));
  },
  async importOffers(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw badRequest('Envie o arquivo no campo "file".');
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    res.json(await importOffers(file.buffer, file.originalname, { dryRun, userId: uid(req) }));
  },
  async offersTemplate(_req: Request, res: Response) {
    const offers = await listOffers();
    const lines = ['sku;praca;preco;preco_de;inicio;fim;condicoes;status'];
    for (const o of offers) lines.push([o.sku, o.praca, (o.priceCents / 100).toFixed(2).replace('.', ','), o.listPriceCents ? (o.listPriceCents / 100).toFixed(2).replace('.', ',') : '', o.startsAt, o.endsAt, o.conditions, o.status].join(';'));
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="ofertas.csv"');
    res.send('﻿' + lines.join('\n'));
  },
};

/* ----------------------------- Campanhas -------------------------- */
async function contextBundle(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw notFound('Campanha');
  const [products, pracas, today, rules] = await Promise.all([getProducts(campaign.briefing.skus), listPracas(), getToday(), getRulesConfig()]);
  const offersByPraca: Record<string, Awaited<ReturnType<typeof offerSource.getOffers>>> = {};
  for (const p of campaign.briefing.pracas) offersByPraca[p] = await offerSource.getOffers(p, campaign.briefing.skus);
  return { campaign, bundle: presentContextBundle({ products, offersByPraca, pracas, today, rules, campaign }) };
}

export const CampaignController = {
  async list(_req: Request, res: Response) {
    res.json(await overview());
  },
  async preview(req: Request, res: Response) {
    res.json(await previewBriefing(req.body));
  },
  async create(req: Request, res: Response) {
    const c = await createCampaign(req.body, uid(req));
    res.status(201).json(presentCampaign(c));
  },
  async detail(req: Request, res: Response) {
    const id = param(req, 'id');
    const { campaign, bundle } = await contextBundle(id);
    const creatives = await listCreatives(id);
    const versions = await getCurrentVersions(creatives.map((c) => c.id));
    res.json({
      campaign: presentCampaign(campaign),
      concept: (await getCurrentConcept(id)) ?? null,
      concepts: await listConcepts(id),
      creatives: creatives.map((c) => presentCreative(c, versions[c.id])),
      context: bundle,
      exports: (await listExports(id)).map((e) => ({ id: e.id, fileName: e.fileName, count: e.count, createdAt: e.createdAt, createdBy: e.createdBy, blocked: (e.manifest.blocked as unknown[] | undefined)?.length ?? 0 })),
    });
  },
  async generateConcept(req: Request, res: Response) {
    const { feedback } = z.object({ feedback: z.string().max(500).optional() }).parse(req.body ?? {});
    res.json(await generateConcept(param(req, 'id'), uid(req), feedback));
  },
  async messages(req: Request, res: Response) {
    res.json(await getCampaignMessages(param(req, 'id')));
  },
  async editConcept(req: Request, res: Response) {
    res.json(await editConcept(param(req, 'id'), req.body, uid(req)));
  },
  async generatePieces(req: Request, res: Response) {
    res.json(await generatePieces(param(req, 'id'), uid(req)));
  },
  async revalidate(req: Request, res: Response) {
    const id = param(req, 'id');
    const campaign = await getCampaign(id);
    const creatives = await listCreatives(id);
    const versions = await getCurrentVersions(creatives.map((c) => c.id));
    const counts: Record<string, number> = {};
    for (const c of creatives) {
      if (!versions[c.id]) continue;
      const ev = await evaluateVersion(c, versions[c.id], campaign);
      counts[ev.status] = (counts[ev.status] ?? 0) + 1;
    }
    await audit({ campaignId: id, actorId: uid(req), type: 'rules.revalidated', payload: { counts } });
    res.json({ statusCounts: counts });
  },
  async audit(req: Request, res: Response) {
    res.json(await listAudit({ campaignId: param(req, 'id'), limit: Number(req.query.limit ?? 300) }));
  },
  async metrics(req: Request, res: Response) {
    res.json(await campaignMetrics(param(req, 'id')));
  },
  async export(req: Request, res: Response) {
    res.json(await exportCampaign(param(req, 'id'), req.body, uid(req)));
  },
  async download(req: Request, res: Response) {
    const e = await getExport(param(req, 'exportId'));
    if (!e || !existsSync(e.path)) throw notFound('Exportação');
    res.setHeader('content-type', 'application/zip');
    res.setHeader('content-disposition', `attachment; filename="${e.fileName}"`);
    createReadStream(e.path).pipe(res);
  },
};

/* ------------------------------ Peças ----------------------------- */
export const CreativeController = {
  async detail(req: Request, res: Response) {
    const id = param(req, 'id');
    const creative = await getCreative(id);
    if (!creative?.currentVersionId) throw notFound('Peça');
    const [versions, reviews, auditRows] = await Promise.all([listVersions(id), listReviewsForCreative(id), listAudit({ creativeId: id, limit: 100 })]);
    const current = versions.find((v) => v.id === creative.currentVersionId)!;
    const { bundle } = await contextBundle(creative.campaignId);
    const concept = current.conceptId ? (await listConcepts(creative.campaignId)).find((c) => c.id === current.conceptId) : undefined;
    res.json({
      creative: presentCreative(creative, current),
      versions: versions.map((v) => presentVersion(v)),
      reviews,
      audit: auditRows,
      critique: await latestCritique(current.id),
      context: bundle,
      concept: concept ?? null,
    });
  },
  async manualEdit(req: Request, res: Response) {
    const r = await manualEdit(param(req, 'id'), req.body, uid(req));
    res.json({ version: presentVersion(r.version), rejected: r.rejected });
  },
  async proposeAi(req: Request, res: Response) {
    res.json(await proposeAiEdit(param(req, 'id'), req.body, uid(req)));
  },
  async applyAi(req: Request, res: Response) {
    const r = await applyAiEdit(param(req, 'proposalId'), uid(req));
    res.json({ version: presentVersion(r.version), replicated: r.replicated });
  },
  async discardAi(req: Request, res: Response) {
    res.json(await discardAiEdit(param(req, 'proposalId'), uid(req)));
  },
  async restore(req: Request, res: Response) {
    const { versionId } = z.object({ versionId: z.string() }).parse(req.body);
    const r = await restoreVersion(param(req, 'id'), versionId, uid(req));
    res.json({ version: presentVersion(r.version) });
  },
  async validate(req: Request, res: Response) {
    const ev = await evaluateCreativeById(param(req, 'id'));
    res.json({ status: ev.status, reason: ev.reason, validation: ev.report });
  },
  async critique(req: Request, res: Response) {
    res.json(await critiqueCreative(param(req, 'id'), uid(req)));
  },
  /** Download unitário — mesmo gate da exportação em lote. */
  async png(req: Request, res: Response) {
    const ev = await evaluateCreativeById(param(req, 'id'));
    const gate = canExport(ev.status, ev.report);
    if (!gate.ok) {
      await audit({ campaignId: ev.creative.campaignId, creativeId: ev.creative.id, actorId: uid(req), type: 'export.blocked', payload: { reason: gate.reason } });
      throw badRequest(gate.reason!);
    }
    const png = await renderPng(ev.version.doc, ev.ctx);
    await audit({ campaignId: ev.creative.campaignId, creativeId: ev.creative.id, versionId: ev.version.id, actorId: uid(req), type: 'export.single', payload: { number: ev.version.number } });
    res.setHeader('content-type', 'image/png');
    res.setHeader('content-disposition', `attachment; filename="${ev.creative.praca}_${ev.creative.format}_${ev.creative.segmentId}_v${ev.version.number}.png"`);
    res.send(png);
  },
  async version(req: Request, res: Response) {
    const v = await getVersion(param(req, 'versionId'));
    if (!v) throw notFound('Versão');
    res.json(presentVersion(v));
  },
};

/* ----------------------------- Revisão ---------------------------- */
export const ReviewController = {
  async queue(_req: Request, res: Response) {
    const q = await reviewQueue();
    const bundles: Record<string, unknown> = {};
    for (const id of new Set(q.items.map((i) => i.creative.campaignId))) bundles[id] = (await contextBundle(id)).bundle;
    res.json({
      concepts: q.concepts,
      items: q.items.map((i) => ({ creative: presentCreative(i.creative, i.version), campaign: i.campaign ? { id: i.campaign.id, name: i.campaign.name } : null, baseVersion: i.baseVersion })),
      contexts: bundles,
    });
  },
  async concept(req: Request, res: Response) {
    res.json(await reviewConcept(param(req, 'id'), req.body, uid(req)));
  },
  async creative(req: Request, res: Response) {
    res.json(await reviewCreative(param(req, 'id'), req.body, uid(req)));
  },
  async batch(req: Request, res: Response) {
    const { creativeIds } = z.object({ creativeIds: z.array(z.string()).min(1).max(200) }).parse(req.body);
    res.json(await batchApprove(creativeIds, uid(req)));
  },
  async semanticConcept(req: Request, res: Response) {
    res.json(await semanticForConcept(param(req, 'id')));
  },
  async semanticCreative(req: Request, res: Response) {
    res.json(await semanticForCreative(param(req, 'id')));
  },
  async dismissSemantic(req: Request, res: Response) {
    const b = z.object({ findingId: z.string(), reason: z.string().min(3).max(500), campaignId: z.string() }).parse(req.body);
    await dismissFinding(param(req, 'hash'), b.findingId, b.reason, uid(req), b.campaignId);
    res.json({ statusCounts: await reevaluateCampaign(b.campaignId) });
  },
};

/* ------------------------------ Admin ----------------------------- */
export const AdminController = {
  async rules(_req: Request, res: Response) {
    res.json({ config: await getRulesConfig(), catalog: RULES });
  },
  async updateRules(req: Request, res: Response) {
    const cfg = await updateRulesConfig(RulesConfigPatchSchema.parse(req.body));
    await audit({ actorId: uid(req), type: 'rules.updated', payload: { version: cfg.version } });
    res.json(cfg);
  },
  async settings(_req: Request, res: Response) {
    res.json({ today: await getToday(), baseline: await getBaseline() });
  },
  async updateSettings(req: Request, res: Response) {
    const body = z
      .object({
        simulatedToday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        baseline: z.object({ minutesPerPiece: z.number().positive().max(600).nullable(), note: z.string().max(500) }).optional(),
      })
      .parse(req.body);
    if (body.simulatedToday !== undefined) await setSimulatedToday(body.simulatedToday);
    if (body.baseline) await setBaseline(body.baseline);
    await audit({ actorId: uid(req), type: 'settings.updated', payload: body });
    res.json({ today: await getToday(), baseline: await getBaseline() });
  },
  async learnings(_req: Request, res: Response) {
    res.json(await listLearnings());
  },
  async addLearning(req: Request, res: Response) {
    const { text } = z.object({ text: z.string().min(5).max(400) }).parse(req.body);
    const id = await insertLearning({ text, source: 'Cadastro manual', status: 'ativa', createdBy: uid(req) });
    res.status(201).json({ id });
  },
  async decideLearning(req: Request, res: Response) {
    const { status } = z.object({ status: z.enum(['ativa', 'descartada']) }).parse(req.body);
    await setLearningStatus(param(req, 'id'), status, uid(req));
    await audit({ actorId: uid(req), type: `learning.${status}`, payload: { id: param(req, 'id') } });
    res.json({ ok: true });
  },
  async resetDemo(req: Request, res: Response) {
    await seedDatabase({ reset: true });
    await audit({ actorId: uid(req), type: 'demo.reset' });
    res.json({ ok: true, pracas: SEED_PRACAS.length });
  },
};

export { buildContext };
