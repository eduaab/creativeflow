import type { CreativeDoc, CreativeStatus, DiffEntry, FormatId, PatchOp, RejectedOp, ValidationReport, VersionOrigin } from '@cf/shared';
import { db, json } from '../db/client';

export interface CreativeRow {
  id: string;
  campaignId: string;
  format: FormatId;
  praca: string;
  segmentId: string;
  skus: string[];
  currentVersionId: string | null;
  status: CreativeStatus;
  exceptionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRow {
  id: string;
  creativeId: string;
  number: number;
  doc: CreativeDoc;
  origin: VersionOrigin;
  conceptId: string | null;
  authorId: string;
  instruction: string | null;
  ops: PatchOp[] | null;
  rejected: RejectedOp[] | null;
  diff: DiffEntry[] | null;
  validation: ValidationReport | null;
  status: CreativeStatus;
  createdAt: string;
}

const iso = (v: unknown) => new Date(v as string).toISOString();

const mapCreative = (r: Record<string, unknown>): CreativeRow => ({
  id: r.id as string,
  campaignId: r.campaign_id as string,
  format: r.format as FormatId,
  praca: r.praca as string,
  segmentId: r.segment_id as string,
  skus: r.skus as string[],
  currentVersionId: (r.current_version_id as string) ?? null,
  status: r.status as CreativeStatus,
  exceptionReason: (r.exception_reason as string) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const mapVersion = (r: Record<string, unknown>): VersionRow => ({
  id: r.id as string,
  creativeId: r.creative_id as string,
  number: r.number as number,
  doc: r.doc as CreativeDoc,
  origin: r.origin as VersionOrigin,
  conceptId: (r.concept_id as string) ?? null,
  authorId: r.author_id as string,
  instruction: (r.instruction as string) ?? null,
  ops: (r.ops as PatchOp[]) ?? null,
  rejected: (r.rejected as RejectedOp[]) ?? null,
  diff: (r.diff as DiffEntry[]) ?? null,
  validation: (r.validation as ValidationReport) ?? null,
  status: r.status as CreativeStatus,
  createdAt: iso(r.created_at),
});

export async function insertCreative(c: Omit<CreativeRow, 'createdAt' | 'updatedAt' | 'currentVersionId' | 'exceptionReason'>) {
  await db().query(
    'insert into creatives (id, campaign_id, format, praca, segment_id, skus, status) values ($1, $2, $3, $4, $5, $6::jsonb, $7)',
    [c.id, c.campaignId, c.format, c.praca, c.segmentId, json(c.skus), c.status],
  );
}
export async function getCreative(id: string): Promise<CreativeRow | undefined> {
  const { rows } = await db().query('select * from creatives where id = $1', [id]);
  return rows[0] ? mapCreative(rows[0]) : undefined;
}
export async function listCreatives(campaignId: string): Promise<CreativeRow[]> {
  const { rows } = await db().query('select * from creatives where campaign_id = $1 order by praca, segment_id, format, created_at', [campaignId]);
  return rows.map(mapCreative);
}
export async function listCreativesByStatus(statuses: CreativeStatus[]): Promise<CreativeRow[]> {
  const { rows } = await db().query('select * from creatives where status = any($1) order by updated_at asc', [statuses]);
  return rows.map(mapCreative);
}
export async function updateCreativeState(id: string, s: { status: CreativeStatus; exceptionReason: string | null; currentVersionId?: string }) {
  if (s.currentVersionId)
    await db().query('update creatives set status = $2, exception_reason = $3, current_version_id = $4, updated_at = now() where id = $1', [id, s.status, s.exceptionReason, s.currentVersionId]);
  else await db().query('update creatives set status = $2, exception_reason = $3, updated_at = now() where id = $1', [id, s.status, s.exceptionReason]);
}

export async function nextVersionNumber(creativeId: string): Promise<number> {
  const { rows } = await db().query<{ n: number }>('select coalesce(max(number), 0) + 1 as n from versions where creative_id = $1', [creativeId]);
  return Number(rows[0].n);
}
export async function insertVersion(v: Omit<VersionRow, 'createdAt'>) {
  await db().query(
    `insert into versions (id, creative_id, number, doc, origin, concept_id, author_id, instruction, ops, rejected, diff, validation, status)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)`,
    [v.id, v.creativeId, v.number, json(v.doc), v.origin, v.conceptId, v.authorId, v.instruction, json(v.ops), json(v.rejected), json(v.diff), json(v.validation), v.status],
  );
}
export async function updateVersionValidation(id: string, validation: ValidationReport, status: CreativeStatus) {
  await db().query('update versions set validation = $2::jsonb, status = $3 where id = $1', [id, json(validation), status]);
}
export async function getVersion(id: string): Promise<VersionRow | undefined> {
  const { rows } = await db().query('select * from versions where id = $1', [id]);
  return rows[0] ? mapVersion(rows[0]) : undefined;
}
export async function listVersions(creativeId: string): Promise<VersionRow[]> {
  const { rows } = await db().query('select * from versions where creative_id = $1 order by number desc', [creativeId]);
  return rows.map(mapVersion);
}
export async function getCurrentVersions(creativeIds: string[]): Promise<Record<string, VersionRow>> {
  if (!creativeIds.length) return {};
  const { rows } = await db().query(
    'select v.* from versions v join creatives c on c.current_version_id = v.id where c.id = any($1)',
    [creativeIds],
  );
  return Object.fromEntries(rows.map((r) => [r.creative_id as string, mapVersion(r)]));
}
export async function getSiblings(c: CreativeRow): Promise<CreativeRow[]> {
  const { rows } = await db().query(
    'select * from creatives where campaign_id = $1 and format = $2 and segment_id = $3 and skus = $4::jsonb and id <> $5',
    [c.campaignId, c.format, c.segmentId, json(c.skus), c.id],
  );
  return rows.map(mapCreative);
}

/* Propostas de edição por IA (prévia antes de salvar) */
export interface ProposalRow {
  id: string;
  creativeId: string;
  baseVersionId: string;
  instruction: string;
  scope: 'piece' | 'siblings';
  data: Record<string, unknown>;
  status: 'pendente' | 'aplicada' | 'descartada' | 'recusada';
  authorId: string;
  createdAt: string;
}
export async function insertProposal(p: Omit<ProposalRow, 'createdAt'>) {
  await db().query(
    'insert into ai_proposals (id, creative_id, base_version_id, instruction, scope, data, status, author_id) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',
    [p.id, p.creativeId, p.baseVersionId, p.instruction, p.scope, json(p.data), p.status, p.authorId],
  );
}
export async function getProposal(id: string): Promise<ProposalRow | undefined> {
  const { rows } = await db().query('select * from ai_proposals where id = $1', [id]);
  const r = rows[0];
  if (!r) return undefined;
  return {
    id: r.id as string,
    creativeId: r.creative_id as string,
    baseVersionId: r.base_version_id as string,
    instruction: r.instruction as string,
    scope: r.scope as ProposalRow['scope'],
    data: r.data as Record<string, unknown>,
    status: r.status as ProposalRow['status'],
    authorId: r.author_id as string,
    createdAt: iso(r.created_at),
  };
}
export async function setProposalStatus(id: string, status: ProposalRow['status']) {
  await db().query('update ai_proposals set status = $2 where id = $1', [id, status]);
}
