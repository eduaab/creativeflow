import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env';
import { SCHEMA_SQL } from './schema';

/**
 * Camada mínima de acesso a dados. Mesma interface para:
 *  - PGlite (Postgres em WebAssembly, arquivo local) — zero configuração na demo;
 *  - Postgres real (Azure Database for PostgreSQL, Neon, Supabase…) via DATABASE_URL.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  kind: 'pglite' | 'postgres' | 'memory';
}

let instance: Db | null = null;

export async function createDb(opts: { memory?: boolean } = {}): Promise<Db> {
  if (!opts.memory && env.databaseUrl) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: env.databaseUrl, ssl: env.databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
    const db: Db = {
      kind: 'postgres',
      query: async (sql, params) => {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows };
      },
      exec: async (sql) => {
        await pool.query(sql);
      },
      close: () => pool.end(),
    };
    await db.exec(SCHEMA_SQL);
    return db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  let pglite: InstanceType<typeof PGlite>;
  if (opts.memory) pglite = new PGlite();
  else {
    const dir = resolve(env.dataDir, 'pglite');
    mkdirSync(dir, { recursive: true });
    pglite = new PGlite(dir);
  }
  const db: Db = {
    kind: opts.memory ? 'memory' : 'pglite',
    query: async (sql, params) => {
      const r = await pglite.query(sql, params as unknown[]);
      return { rows: r.rows as never[] };
    },
    exec: async (sql) => {
      await pglite.exec(sql);
    },
    close: () => pglite.close(),
  };
  await db.exec(SCHEMA_SQL);
  return db;
}

export async function initDb(opts: { memory?: boolean } = {}): Promise<Db> {
  instance = await createDb(opts);
  return instance;
}

export function db(): Db {
  if (!instance) throw new Error('Banco não inicializado. Chame initDb() antes.');
  return instance;
}

export function setDb(d: Db) {
  instance = d;
}

export const json = (v: unknown) => JSON.stringify(v ?? null);
