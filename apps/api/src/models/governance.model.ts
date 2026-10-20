import { db, json } from '../db/client';
import { newId } from '../utils/id';

/* Revisões humanas */
export interface ReviewRow {
  id: string;
  creativeId: string | null;
  versionId: string | null;
  conceptId: string | null;
  reviewerId: string;
  decision: 'aprovado' | 'ajustes' | 'reprovado';
  comment: string | null;
  createdAt: string;
}
const mapReview = (r: Record<string, unknown>): ReviewRow => ({
  id: r.id as string,
  creativeId: (r.creative_id as string) ?? null,
  versionId: (r.version_id as string) ?? null,
  conceptId: (r.concept_id as string) ?? null,
  reviewerId: r.reviewer_id as string,
  decision: r.decision as ReviewRow['decision'],
  comment: (r.comment as string) ?? null,
  createdAt: new Date(r.created_at as string).toISOString(),
});
export async function insertReview(r: Omit<ReviewRow, 'id' | 'createdAt'>): Promise<string> {
  const id = newId('rev');
  await db().query('insert into reviews (id, creative_id, version_id, concept_id, reviewer_id, decision, comment) values ($1,$2,$3,$4,$5,$6,$7)', [
    id,
    r.creativeId,
    r.versionId,
    r.conceptId,
    r.reviewerId,
    r.decision,
    r.comment,
  ]);
  return id;
}
export async function getDecisionForVersion(versionId: string): Promise<'aprovado' | 'ajustes' | null> {
  const { rows } = await db().query<{ decision: string }>('select decision from reviews where version_id = $1 order by created_at desc limit 1', [versionId]);
  const d = rows[0]?.decision;
  return d === 'aprovado' ? 'aprovado' : d === 'ajustes' || d === 'reprovado' ? 'ajustes' : null;
}
export async function listReviewsForCreative(creativeId: string): Promise<ReviewRow[]> {
  const { rows } = await db().query('select * from reviews where creative_id = $1 order by created_at desc', [creativeId]);
  return rows.map(mapReview);
}

/* Trilha de auditoria */
export interface AuditInput {
  campaignId?: string | null;
  creativeId?: string | null;
  versionId?: string | null;
  actorId?: string | null;
  type: string;
  payload?: unknown;
}
export async function audit(e: AuditInput) {
  await db().query('insert into audit_events (id, campaign_id, creative_id, version_id, actor_id, type, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)', [
    newId('evt'),
    e.campaignId ?? null,
    e.creativeId ?? null,
    e.versionId ?? null,
    e.actorId ?? null,
    e.type,
    json(e.payload ?? {}),
  ]);
}
export interface AuditRow {
  id: string;
  campaignId: string | null;
  creativeId: string | null;
  versionId: string | null;
  actorId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
export async function listAudit(filter: { campaignId?: string; creativeId?: string; limit?: number }): Promise<AuditRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.campaignId) {
    params.push(filter.campaignId);
    where.push(`campaign_id = $${params.length}`);
  }
  if (filter.creativeId) {
    params.push(filter.creativeId);
    where.push(`creative_id = $${params.length}`);
  }
  params.push(filter.limit ?? 500);
  const { rows } = await db().query(
    `select * from audit_events ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc limit $${params.length}`,
    params,
  );
  return rows.map((r) => ({
    id: r.id as string,
    campaignId: (r.campaign_id as string) ?? null,
    creativeId: (r.creative_id as string) ?? null,
    versionId: (r.version_id as string) ?? null,
    actorId: (r.actor_id as string) ?? null,
    type: r.type as string,
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/* Aprendizados de marca (vindos de reprovações) */
export interface LearningRow {
  id: string;
  text: string;
  source: string;
  sourceReviewId: string | null;
  status: 'sugerida' | 'ativa' | 'descartada';
  createdBy: string;
  decidedBy: string | null;
  createdAt: string;
}
export async function insertLearning(l: { text: string; source: string; sourceReviewId?: string | null; status?: LearningRow['status']; createdBy: string }) {
  const id = newId('lrn');
  await db().query('insert into learnings (id, text, source, source_review_id, status, created_by) values ($1,$2,$3,$4,$5,$6)', [
    id,
    l.text,
    l.source,
    l.sourceReviewId ?? null,
    l.status ?? 'sugerida',
    l.createdBy,
  ]);
  return id;
}
export async function listLearnings(status?: LearningRow['status']): Promise<LearningRow[]> {
  const { rows } = await db().query(`select * from learnings ${status ? 'where status = $1' : ''} order by created_at desc`, status ? [status] : []);
  return rows.map((r) => ({
    id: r.id as string,
    text: r.text as string,
    source: r.source as string,
    sourceReviewId: (r.source_review_id as string) ?? null,
    status: r.status as LearningRow['status'],
    createdBy: r.created_by as string,
    decidedBy: (r.decided_by as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
export async function setLearningStatus(id: string, status: LearningRow['status'], by: string) {
  await db().query('update learnings set status = $2, decided_by = $3 where id = $1', [id, status, by]);
}

/* Configurações */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const { rows } = await db().query<{ value: T }>('select value from settings where key = $1', [key]);
  return rows[0]?.value;
}
export async function setSetting(key: string, value: unknown) {
  await db().query('insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value', [key, json(value)]);
}

/* Exportações */
export interface ExportRow {
  id: string;
  campaignId: string;
  fileName: string;
  path: string;
  count: number;
  manifest: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}
export async function insertExport(e: Omit<ExportRow, 'createdAt'>) {
  await db().query('insert into exports (id, campaign_id, file_name, path, count, manifest, created_by) values ($1,$2,$3,$4,$5,$6::jsonb,$7)', [
    e.id,
    e.campaignId,
    e.fileName,
    e.path,
    e.count,
    json(e.manifest),
    e.createdBy,
  ]);
}
export async function listExports(campaignId: string): Promise<ExportRow[]> {
  const { rows } = await db().query('select * from exports where campaign_id = $1 order by created_at desc', [campaignId]);
  return rows.map((r) => ({
    id: r.id as string,
    campaignId: r.campaign_id as string,
    fileName: r.file_name as string,
    path: r.path as string,
    count: r.count as number,
    manifest: r.manifest as Record<string, unknown>,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
export async function getExport(id: string): Promise<ExportRow | undefined> {
  const { rows } = await db().query('select * from exports where id = $1', [id]);
  const r = rows[0];
  if (!r) return undefined;
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    fileName: r.file_name as string,
    path: r.path as string,
    count: r.count as number,
    manifest: r.manifest as Record<string, unknown>,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/* Críticas do revisor de marca (IA multimodal) */
export async function insertCritique(c: { creativeId: string; versionId: string; provider: string; data: unknown }) {
  const id = newId('crt');
  await db().query('insert into critiques (id, creative_id, version_id, provider, data) values ($1,$2,$3,$4,$5::jsonb)', [id, c.creativeId, c.versionId, c.provider, json(c.data)]);
  return id;
}
export async function latestCritique(versionId: string) {
  const { rows } = await db().query('select * from critiques where version_id = $1 order by created_at desc limit 1', [versionId]);
  const r = rows[0];
  return r ? { id: r.id as string, provider: r.provider as string, data: r.data, createdAt: new Date(r.created_at as string).toISOString() } : null;
}
