import { SEED_PRACAS, SEED_PRODUCTS, SEED_SEGMENTS, SEED_USERS, buildSeedOffers } from '@cf/shared';
import { db } from './client';
import { upsertOffer, upsertPraca, upsertProduct, upsertSegment } from '../models/catalog.model';
import { upsertUser } from '../models/user.model';
import { setSetting } from '../models/governance.model';

/** Popula a base sintética. Idempotente; `reset` apaga campanhas e histórico. */
export async function seedDatabase(opts: { reset?: boolean; today?: string } = {}) {
  if (opts.reset) {
    await db().exec(
      'delete from audit_events; delete from reviews; delete from ai_proposals; delete from versions; delete from creatives; delete from concepts; delete from campaigns; delete from exports; delete from critiques; delete from semantic_checks; delete from learnings; delete from offers; delete from settings;',
    );
  }
  for (const u of SEED_USERS) await upsertUser(u);
  for (const p of SEED_PRACAS) await upsertPraca(p);
  for (const s of SEED_SEGMENTS) await upsertSegment(s);
  for (const p of SEED_PRODUCTS) await upsertProduct(p);
  for (const o of buildSeedOffers(opts.today)) await upsertOffer(o, 'seed');
  await setSetting('seededAt', new Date().toISOString());
}

export async function seedIfEmpty() {
  const { rows } = await db().query<{ n: number }>('select count(*)::int as n from users');
  if (Number(rows[0].n) === 0) await seedDatabase();
}
