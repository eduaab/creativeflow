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
  aiProvider: str('AI_PROVIDER', 'mock') as 'mock' | 'openai' | 'azure-openai' | 'anthropic',
  openai: { key: str('OPENAI_API_KEY'), model: str('OPENAI_MODEL', 'gpt-4o-mini'), baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1') },
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
