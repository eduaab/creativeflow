import type { Offer, Praca, Product, Segment } from '@cf/shared';
import { db, json } from '../db/client';

/* Produtos */
export async function listProducts(): Promise<Product[]> {
  const { rows } = await db().query<{ data: Product }>('select data from products order by sku');
  return rows.map((r) => r.data);
}
export async function getProducts(skus: string[]): Promise<Record<string, Product>> {
  if (!skus.length) return {};
  const { rows } = await db().query<{ data: Product }>('select data from products where sku = any($1)', [skus]);
  return Object.fromEntries(rows.map((r) => [r.data.sku, r.data]));
}
export async function upsertProduct(p: Product) {
  await db().query(
    `insert into products (sku, data, updated_at) values ($1, $2::jsonb, now())
     on conflict (sku) do update set data = excluded.data, updated_at = now()`,
    [p.sku, json(p)],
  );
}

/* Praças */
export async function listPracas(): Promise<Praca[]> {
  const { rows } = await db().query<Praca>('select code, name from pracas order by code');
  return rows;
}
export async function getPraca(code: string): Promise<Praca | undefined> {
  const { rows } = await db().query<Praca>('select code, name from pracas where code = $1', [code]);
  return rows[0];
}
export async function upsertPraca(p: Praca) {
  await db().query('insert into pracas (code, name) values ($1, $2) on conflict (code) do update set name = excluded.name', [p.code, p.name]);
}

/* Segmentos (públicos) */
export async function listSegments(): Promise<Segment[]> {
  const { rows } = await db().query<{ data: Segment }>('select data from segments order by id');
  return rows.map((r) => r.data);
}
export async function upsertSegment(s: Segment) {
  await db().query('insert into segments (id, data) values ($1, $2::jsonb) on conflict (id) do update set data = excluded.data', [s.id, json(s)]);
}

/* Ofertas — única fonte de valores comerciais */
export async function listOffers(filter: { praca?: string; sku?: string } = {}): Promise<(Offer & { source: string; updatedAt: string })[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.praca) {
    params.push(filter.praca);
    where.push(`praca = $${params.length}`);
  }
  if (filter.sku) {
    params.push(filter.sku);
    where.push(`sku = $${params.length}`);
  }
  const { rows } = await db().query<{ data: Offer; source: string; updated_at: string }>(
    `select data, source, updated_at from offers ${where.length ? 'where ' + where.join(' and ') : ''} order by sku, praca`,
    params,
  );
  return rows.map((r) => ({ ...r.data, source: r.source, updatedAt: String(r.updated_at) }));
}

/** Oferta vigente/mais recente para cada SKU numa praça (a regra decide se serve). */
export async function getOffersFor(praca: string, skus: string[]): Promise<Record<string, Offer | undefined>> {
  if (!skus.length) return {};
  const { rows } = await db().query<{ data: Offer }>(
    `select data from offers where praca = $1 and sku = any($2) order by updated_at desc`,
    [praca, skus],
  );
  const out: Record<string, Offer | undefined> = {};
  for (const s of skus) out[s] = undefined;
  // prioriza ofertas ativas com maior data de fim
  const sorted = rows.map((r) => r.data).sort((a, b) => (a.status === b.status ? b.endsAt.localeCompare(a.endsAt) : a.status === 'ativa' ? -1 : 1));
  for (const o of sorted) if (!out[o.sku]) out[o.sku] = o;
  return out;
}

export async function upsertOffer(o: Offer, source = 'seed') {
  await db().query(
    `insert into offers (id, sku, praca, data, source, updated_at) values ($1, $2, $3, $4::jsonb, $5, now())
     on conflict (id) do update set sku = excluded.sku, praca = excluded.praca, data = excluded.data, source = excluded.source, updated_at = now()`,
    [o.id, o.sku, o.praca, json(o), source],
  );
}
