import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(here, '../../../..');
export const API_DIR = resolve(here, '../..');

for (const p of [resolve(ROOT_DIR, '.env'), resolve(API_DIR, '.env')]) if (existsSync(p)) config({ path: p });

const str = (k: string, d = '') => (process.env[k] ?? d).trim();

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: Number(str('PORT', '3001')),
  databaseUrl: str('DATABASE_URL'),
  dataDir: str('DATA_DIR', resolve(ROOT_DIR, 'data')),
  jwtSecret: str('JWT_SECRET', 'dev-secret-troque'),
  /** Tempo máximo de espera por resposta da IA (ms). Modelos que "pensam" podem levar mais de 1 minuto. */
  aiTimeoutMs: Number(str('AI_TIMEOUT_MS', '120000')),
  aiProvider: str('AI_PROVIDER', 'mock') as 'mock' | 'openai' | 'azure-openai' | 'anthropic',
  openai: {
    key: str('OPENAI_API_KEY'),
    model: str('OPENAI_MODEL', 'gpt-4o-mini'),
    /** Modelos reserva, separados por vírgula, usados quando o principal está sobrecarregado (503/429). */
    fallbackModels: str('OPENAI_FALLBACK_MODELS').split(',').map((m) => m.trim()).filter(Boolean),
    baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  },
  azure: {
    endpoint: str('AZURE_OPENAI_ENDPOINT'),
    key: str('AZURE_OPENAI_API_KEY'),
    deployment: str('AZURE_OPENAI_DEPLOYMENT'),
    apiVersion: str('AZURE_OPENAI_API_VERSION', '2024-10-21'),
  },
  anthropic: { key: str('ANTHROPIC_API_KEY'), model: str('ANTHROPIC_MODEL', 'claude-sonnet-4-5') },
  teamsWebhookUrl: str('TEAMS_WEBHOOK_URL'),
  appPublicUrl: str('APP_PUBLIC_URL', 'http://localhost:5173'),
  chromiumPath: str('CHROMIUM_PATH'),
  webDist: resolve(ROOT_DIR, 'apps/web/dist'),
};

export const isProd = env.nodeEnv === 'production';
