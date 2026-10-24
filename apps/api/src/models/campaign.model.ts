import type { Briefing, Concept } from '@cf/shared';
import { db, json } from '../db/client';

export interface CampaignRow {
  id: string;
  name: string;
  briefing: Briefing;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  firstExportAt: string | null;
}

const mapCampaign = (r: Record<string, unknown>): CampaignRow => ({
  id: r.id as string,
  name: r.name as string,
  briefing: r.briefing as Briefing,
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
  firstExportAt: r.first_export_at ? new Date(r.first_export_at as string).toISOString() : null,
});

export async function insertCampaign(c: { id: string; briefing: Briefing; createdBy: string }) {
  await db().query('insert into campaigns (id, name, briefing, created_by) values ($1, $2, $3::jsonb, $4)', [c.id, c.briefing.name, json(c.briefing), c.createdBy]);
}
export async function updateCampaignBriefing(id: string, b: Briefing) {
  await db().query('update campaigns set briefing = $2::jsonb, name = $3, updated_at = now() where id = $1', [id, json(b), b.name]);
}
export async function getCampaign(id: string): Promise<CampaignRow | undefined> {
  const { rows } = await db().query('select * from campaigns where id = $1', [id]);
  return rows[0] ? mapCampaign(rows[0]) : undefined;
}
export async function listCampaigns(): Promise<CampaignRow[]> {
  const { rows } = await db().query('select * from campaigns order by created_at desc');
  return rows.map(mapCampaign);
}
export async function markFirstExport(id: string) {
  await db().query('update campaigns set first_export_at = coalesce(first_export_at, now()), updated_at = now() where id = $1', [id]);
}
export async function touchCampaign(id: string) {
  await db().query('update campaigns set updated_at = now() where id = $1', [id]);
}

/* Conceitos */
export type ConceptStatus = 'proposto' | 'aprovado' | 'substituido' | 'reprovado';
export interface ConceptRow {
  id: string;
  campaignId: string;
  number: number;
  data: Concept;
  source: string;
  status: ConceptStatus;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}
const mapConcept = (r: Record<string, unknown>): ConceptRow => ({
  id: r.id as string,
  campaignId: r.campaign_id as string,
  number: r.number as number,
  data: r.data as Concept,
  source: r.source as string,
  status: r.status as ConceptStatus,
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string).toISOString(),
  approvedBy: (r.approved_by as string) ?? null,
  approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
});

export async function insertConcept(c: { id: string; campaignId: string; data: Concept; source: string; createdBy: string }): Promise<ConceptRow> {
  const { rows } = await db().query<{ n: number }>('select coalesce(max(number), 0) + 1 as n from concepts where campaign_id = $1', [c.campaignId]);
  await db().query("update concepts set status = 'substituido' where campaign_id = $1 and status in ('proposto','aprovado')", [c.campaignId]);
  await db().query(
    "insert into concepts (id, campaign_id, number, data, source, status, created_by) values ($1, $2, $3, $4::jsonb, $5, 'proposto', $6)",
    [c.id, c.campaignId, Number(rows[0].n), json(c.data), c.source, c.createdBy],
  );
  return (await getConcept(c.id))!;
}
export async function getConcept(id: string): Promise<ConceptRow | undefined> {
  const { rows } = await db().query('select * from concepts where id = $1', [id]);
  return rows[0] ? mapConcept(rows[0]) : undefined;
}
export async function getCurrentConcept(campaignId: string): Promise<ConceptRow | undefined> {
  const { rows } = await db().query("select * from concepts where campaign_id = $1 and status in ('proposto','aprovado','reprovado') order by number desc limit 1", [campaignId]);
  return rows[0] ? mapConcept(rows[0]) : undefined;
}
export async function listConcepts(campaignId: string): Promise<ConceptRow[]> {
  const { rows } = await db().query('select * from concepts where campaign_id = $1 order by number desc', [campaignId]);
  return rows.map(mapConcept);
}
/** Conceitos já aprovados em OUTRAS campanhas (mais recentes primeiro): referência de estilo para a IA. */
export async function listApprovedConceptExamples(excludeCampaignId: string, limit = 4): Promise<{ campaign: string; objective: string; data: Concept }[]> {
  const { rows } = await db().query(
    `select c.data, k.briefing from concepts c join campaigns k on k.id = c.campaign_id
     where c.approved_at is not null and c.campaign_id <> $1 order by c.approved_at desc limit $2`,
    [excludeCampaignId, limit],
  );
  return rows.map((r: Record<string, unknown>) => {
    const b = r.briefing as { name: string; objective: string };
    return { campaign: b.name, objective: b.objective, data: r.data as Concept };
  });
}
export async function setConceptStatus(id: string, status: ConceptStatus, by?: string) {
  if (status === 'aprovado') await db().query("update concepts set status = 'aprovado', approved_by = $2, approved_at = now() where id = $1", [id, by]);
  else await db().query('update concepts set status = $2 where id = $1', [id, status]);
}
