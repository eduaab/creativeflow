import type { SemanticCheck, SemanticFinding } from '@cf/shared';
import { db, json } from '../db/client';

const map = (r: Record<string, unknown>): SemanticCheck => ({
  hash: r.hash as string,
  provider: r.provider as string,
  fallback: !!r.fallback,
  error: (r.error as string) ?? null,
  findings: r.findings as SemanticFinding[],
  dismissed: (r.dismissed as SemanticCheck['dismissed']) ?? {},
  createdAt: new Date(r.created_at as string).toISOString(),
});

export async function getSemanticCheck(hash: string): Promise<SemanticCheck | null> {
  const { rows } = await db().query('select * from semantic_checks where hash = $1', [hash]);
  return rows[0] ? map(rows[0]) : null;
}

export async function insertSemanticCheck(c: { hash: string; provider: string; fallback: boolean; error: string | null; findings: SemanticFinding[] }) {
  await db().query('insert into semantic_checks (hash, provider, fallback, error, findings) values ($1,$2,$3,$4,$5::jsonb) on conflict (hash) do nothing', [c.hash, c.provider, c.fallback, c.error, json(c.findings)]);
}

export async function setSemanticDismissed(hash: string, dismissed: SemanticCheck['dismissed']) {
  await db().query('update semantic_checks set dismissed = $2::jsonb where hash = $1', [hash, json(dismissed)]);
}
