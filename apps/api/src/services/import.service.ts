import { OfferSchema, type Offer } from '@cf/shared';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { db } from '../db/client';
import { getProducts, listPracas, upsertOffer } from '../models/catalog.model';
import { listCampaigns } from '../models/campaign.model';
import { getCurrentVersions, listCreatives } from '../models/creative.model';
import { audit } from '../models/governance.model';
import { badRequest } from '../utils/errors';
import { evaluateVersion } from './validation.service';

/**
 * Entrada pelo formato que o time já usa: planilha de ofertas por praça (CSV ou XLSX).
 * Colunas aceitas (sem diferenciar maiúsculas/acentos): sku, praca|uf|estado, preco,
 * preco_de, inicio, fim, condicoes, status.
 */
const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'cod'],
  praca: ['praca', 'uf', 'estado', 'regiao'],
  preco: ['preco', 'preco_por', 'price', 'valor'],
  preco_de: ['preco_de', 'de', 'list_price', 'preco_cheio'],
  inicio: ['inicio', 'starts_at', 'data_inicio', 'vigencia_inicio'],
  fim: ['fim', 'ends_at', 'data_fim', 'vigencia_fim'],
  condicoes: ['condicoes', 'condicao', 'conditions'],
  status: ['status', 'situacao'],
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

function canonicalKey(header: string): string | undefined {
  const h = norm(header);
  return Object.entries(ALIASES).find(([, list]) => list.includes(h))?.[0];
}

export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v).replace(/r\$\s?/i, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function parseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

async function readRows(buffer: Buffer, filename: string): Promise<Record<string, unknown>[]> {
  if (/\.xlsx$/i.test(filename)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.value ?? '')));
    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const r: Record<string, unknown> = {};
      row.eachCell((cell, col) => {
        const v = cell.value as unknown;
        r[headers[col]] = v && typeof v === 'object' && 'result' in (v as object) ? (v as { result: unknown }).result : v;
      });
      rows.push(r);
    });
    return rows;
  }
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter });
  return parsed.data;
}

export interface ImportReport {
  total: number;
  valid: number;
  errors: { line: number; message: string }[];
  offers: Offer[];
  saved: boolean;
  reevaluated?: number;
}

export async function importOffers(buffer: Buffer, filename: string, opts: { dryRun: boolean; userId: string }): Promise<ImportReport> {
  if (!/\.(csv|xlsx)$/i.test(filename)) throw badRequest('Envie um arquivo .csv ou .xlsx.');
  const rows = await readRows(buffer, filename);
  const pracas = new Set((await listPracas()).map((p) => p.code));
  const skus = rows.map((r) => String(Object.entries(r).find(([k]) => canonicalKey(k) === 'sku')?.[1] ?? '').trim());
  const products = await getProducts(skus.filter(Boolean));
  const errors: ImportReport['errors'] = [];
  const offers: Offer[] = [];

  rows.forEach((raw, idx) => {
    const line = idx + 2;
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = canonicalKey(k);
      if (key) r[key] = v;
    }
    const sku = String(r.sku ?? '').trim();
    const praca = String(r.praca ?? '').trim().toUpperCase();
    const price = parseMoney(r.preco);
    const list = parseMoney(r.preco_de);
    const startsAt = parseDate(r.inicio);
    const endsAt = parseDate(r.fim);
    const problems: string[] = [];
    if (!products[sku]) problems.push(`SKU "${sku}" não existe no catálogo`);
    if (!pracas.has(praca)) problems.push(`praça "${praca}" desconhecida`);
    if (!price) problems.push('preço inválido');
    if (!startsAt || !endsAt) problems.push('datas inválidas (use AAAA-MM-DD ou DD/MM/AAAA)');
    if (startsAt && endsAt && endsAt < startsAt) problems.push('fim antes do início');
    if (list && price && list <= price) problems.push('preço "de" deve ser maior que o preço');
    if (problems.length) {
      errors.push({ line, message: problems.join('; ') });
      return;
    }
    const status = norm(String(r.status ?? 'ativa')).startsWith('inativ') ? 'inativa' : 'ativa';
    const parsed = OfferSchema.safeParse({
      id: `OF-${sku.replace(/^SKU-/, '')}-${praca}`,
      sku,
      praca,
      priceCents: price,
      listPriceCents: list,
      startsAt,
      endsAt,
      conditions: String(r.condicoes ?? '').trim() || 'ou enquanto durarem os estoques',
      status,
    });
    if (!parsed.success) errors.push({ line, message: parsed.error.issues.map((i) => i.message).join('; ') });
    else offers.push(parsed.data);
  });

  const report: ImportReport = { total: rows.length, valid: offers.length, errors, offers, saved: false };
  if (opts.dryRun || !offers.length) return report;

  for (const o of offers) {
    await db().query('delete from offers where sku = $1 and praca = $2', [o.sku, o.praca]);
    await upsertOffer(o, `import:${filename}`);
  }
  report.saved = true;
  // Revalida todas as peças: um preço novo pode liberar ou bloquear peças existentes.
  let n = 0;
  for (const camp of await listCampaigns()) {
    const creatives = await listCreatives(camp.id);
    const versions = await getCurrentVersions(creatives.map((c) => c.id));
    for (const c of creatives) {
      if (!versions[c.id]) continue;
      if (!c.skus.some((s) => offers.some((o) => o.sku === s && o.praca === c.praca))) continue;
      await evaluateVersion(c, versions[c.id], camp);
      n++;
    }
  }
  report.reevaluated = n;
  await audit({ actorId: opts.userId, type: 'offers.imported', payload: { filename, total: rows.length, saved: offers.length, errors: errors.length, reevaluated: n } });
  return report;
}
