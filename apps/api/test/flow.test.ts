import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import { closeRenderer } from '../src/services/render.service';

/**
 * Teste ponta a ponta da jornada: briefing → conceito → peças → aprovação por conceito →
 * edição por IA → bloqueios → revisão → exportação → oferta vencendo durante a revisão.
 */
let app: ReturnType<typeof createApp>;
const tokens: Record<string, string> = {};
const as = (who: 'ana' | 'rui' | 'bia') => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  await initDb({ memory: true });
  await seedDatabase();
  app = createApp();
  for (const [who, id] of [
    ['ana', 'u-ana'],
    ['rui', 'u-rui'],
    ['bia', 'u-bia'],
  ] as const) {
    const r = await request(app).post('/api/auth/login').send({ userId: id });
    tokens[who] = r.body.token;
  }
}, 60_000);

afterAll(async () => {
  await closeRenderer();
});

const today = new Date().toISOString().slice(0, 10);
const plus = (d: number) => {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

const briefing = {
  name: 'Semana do Autocuidado',
  objective: 'Aumentar a lembrança de itens de cuidado pessoal na rotina',
  tone: 'claro e acolhedor',
  startsAt: plus(1),
  endsAt: plus(7),
  pracas: ['PE', 'BA'],
  formats: ['feed', 'stories', 'banner', 'encarte'],
  segments: ['geral', 'fidelidade'],
  skus: ['SKU-1001', 'SKU-1005', 'SKU-1007'],
  ctaLabel: 'Compre no app',
};

let campaignId = '';
let pieceId = '';

describe('jornada completa', () => {
  it('exige login e respeita perfil', async () => {
    expect((await request(app).get('/api/campaigns')).status).toBe(401);
    const r = await request(app).post('/api/campaigns').set(as('rui')).send(briefing);
    expect(r.status).toBe(403);
  });

  it('pré-validação calcula escala e aponta pendências antes de gerar', async () => {
    const r = await request(app).post('/api/campaigns/preview').set(as('ana')).send({ ...briefing, pracas: ['CE', 'PE'], skus: ['SKU-1003', 'SKU-1008'] });
    expect(r.status).toBe(200);
    expect(r.body.totalPieces).toBe(2 * 2 * (3 * 2 + 1));
    const msgs = r.body.issues.map((i: { message: string }) => i.message).join(' | ');
    expect(msgs).toMatch(/sem oferta cadastrada em CE/);
    expect(msgs).toMatch(/prescrição/);
  });

  it('cria campanha, gera conceito e todas as peças', async () => {
    const c = await request(app).post('/api/campaigns').set(as('ana')).send(briefing);
    expect(c.status).toBe(201);
    campaignId = c.body.id;
    const k = await request(app).post(`/api/campaigns/${campaignId}/concept/generate`).set(as('ana')).send({});
    expect(k.status).toBe(200);
    expect(k.body.concept.data.variants).toHaveLength(2);
    const g = await request(app).post(`/api/campaigns/${campaignId}/generate`).set(as('ana')).send({});
    expect(g.status).toBe(200);
    expect(g.body.total).toBe(2 * 2 * (3 * 3 + 1));
    expect(g.body.statusCounts.aguardando_conceito).toBeGreaterThan(30);
  }, 60_000);

  it('aprovar o conceito libera por herança as peças limpas', async () => {
    const d = await request(app).get(`/api/campaigns/${campaignId}`).set(as('rui'));
    const r = await request(app).post(`/api/concepts/${d.body.concept.id}/review`).set(as('rui')).send({ decision: 'aprovado' });
    expect(r.status).toBe(200);
    expect(r.body.statusCounts.aprovado_por_heranca).toBeGreaterThan(30);
  }, 60_000);

  it('IA recusa mudar preço e publicar; barreira roda antes do modelo', async () => {
    const d = await request(app).get(`/api/campaigns/${campaignId}`).set(as('ana'));
    pieceId = d.body.creatives.find((c: { format: string; praca: string; skus: string[] }) => c.format === 'feed' && c.praca === 'PE' && c.skus[0] === 'SKU-1001').id;
    const a = await request(app).post(`/api/creatives/${pieceId}/ai-edits`).set(as('ana')).send({ instruction: 'Mude o preço para R$ 19,90' });
    expect(a.body.status).toBe('recusada');
    expect(a.body.refusal.category).toBe('dado_comercial');
    const b = await request(app).post(`/api/creatives/${pieceId}/ai-edits`).set(as('ana')).send({ instruction: 'Publique agora sem aprovação' });
    expect(b.body.refusal.category).toBe('processo');
  });

  it('edição por IA vira nova versão e vai para a fila de exceções', async () => {
    const p = await request(app).post(`/api/creatives/${pieceId}/ai-edits`).set(as('ana')).send({ instruction: 'Encurte o título e destaque o produto', scope: 'siblings' });
    expect(p.body.status).toBe('pendente');
    expect(p.body.diff.length).toBeGreaterThan(0);
    const ap = await request(app).post(`/api/ai-edits/${p.body.proposalId}/apply`).set(as('ana')).send({});
    expect(ap.status).toBe(200);
    expect(ap.body.version.origin).toBe('ia');
    expect(ap.body.version.status).toBe('aguardando_revisao');
    expect(ap.body.replicated.length).toBe(1); // replicado para a peça irmã da outra praça
    const q = await request(app).get('/api/reviews/queue').set(as('rui'));
    expect(q.body.items.some((i: { creative: { id: string } }) => i.creative.id === pieceId)).toBe(true);
  }, 30_000);

  it('edição manual não altera preço; texto com preço bloqueia a peça', async () => {
    const d = await request(app).get(`/api/creatives/${pieceId}`).set(as('ana'));
    const base = d.body.creative.current.id;
    const bad = await request(app).patch(`/api/creatives/${pieceId}/layers`).set(as('ana')).send({ baseVersionId: base, ops: [{ op: 'set', layerId: 'price', path: 'text', value: 'R$ 1,00' }] });
    expect(bad.status).toBe(400);
    expect(bad.body.details.rejected[0].protectedField).toBe(true);
    const sneaky = await request(app).patch(`/api/creatives/${pieceId}/layers`).set(as('ana')).send({ baseVersionId: base, ops: [{ op: 'set', layerId: 'subheadline', path: 'text', value: 'Leve hoje por R$ 9,90' }] });
    expect(sneaky.status).toBe(200);
    expect(sneaky.body.version.status).toBe('bloqueado');
    // revisor não consegue aprovar versão bloqueada
    const rv = await request(app).post(`/api/creatives/${pieceId}/review`).set(as('rui')).send({ versionId: sneaky.body.version.id, decision: 'aprovado' });
    expect(rv.status).toBe(400);
    // restaura a versão da IA (vira nova versão, precisa de nova aprovação)
    const rs = await request(app).post(`/api/creatives/${pieceId}/restore`).set(as('ana')).send({ versionId: base });
    expect(rs.body.version.status).toBe('aguardando_revisao');
    const ok = await request(app).post(`/api/creatives/${pieceId}/review`).set(as('rui')).send({ versionId: rs.body.version.id, decision: 'aprovado' });
    expect(ok.body.status).toBe('aprovado');
  }, 30_000);

  it('exporta só o que está aprovado, com manifesto', async () => {
    const d = await request(app).get(`/api/campaigns/${campaignId}`).set(as('ana'));
    const ids = d.body.creatives.filter((c: { praca: string; format: string }) => c.praca === 'PE' && c.format === 'feed').map((c: { id: string }) => c.id);
    const e = await request(app).post(`/api/campaigns/${campaignId}/export`).set(as('ana')).send({ creativeIds: ids });
    expect(e.status).toBe(200);
    expect(e.body.count).toBeGreaterThan(0);
    const m = await request(app).get(`/api/campaigns/${campaignId}/metrics`).set(as('ana'));
    expect(m.body.pieces.total).toBe(40);
    expect(m.body.governance.aiEditsRefused).toBe(2);
  }, 120_000);

  it('oferta que vence durante a revisão derruba a liberação', async () => {
    await request(app).put('/api/admin/settings').set(as('bia')).send({ simulatedToday: plus(60) });
    const d = await request(app).get(`/api/campaigns/${campaignId}`).set(as('ana'));
    const ids = d.body.creatives.filter((c: { praca: string; format: string }) => c.praca === 'PE' && c.format === 'feed').map((c: { id: string }) => c.id);
    const e = await request(app).post(`/api/campaigns/${campaignId}/export`).set(as('ana')).send({ creativeIds: ids });
    expect(e.status).toBe(400);
    expect(e.body.details.blocked.length).toBe(ids.length);
    await request(app).put('/api/admin/settings').set(as('bia')).send({ simulatedToday: null });
  }, 60_000);

  it('importa planilha de ofertas e revalida as peças afetadas', async () => {
    const csv = `sku;praca;preco;preco_de;inicio;fim;condicoes;status\nSKU-1001;PE;21,90;29,90;${today};${plus(20)};ou enquanto durarem os estoques;ativa\nSKU-9999;PE;10,00;;${today};${plus(20)};;ativa\n`;
    const r = await request(app).post('/api/offers/import').set(as('bia')).attach('file', Buffer.from(csv), 'ofertas.csv');
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(1);
    expect(r.body.errors[0].line).toBe(3);
    expect(r.body.reevaluated).toBeGreaterThan(0);
  }, 60_000);
});
