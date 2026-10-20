import { env } from './config/env';
import { createApp } from './app';
import { initDb } from './db/client';
import { seedIfEmpty } from './db/seed';
import { aiStatus } from './services/ai';
import { closeRenderer } from './services/render.service';

const db = await initDb();
await seedIfEmpty();
const app = createApp();
const server = app.listen(env.port, () => {
  const ai = aiStatus();
  console.log(`CreativeFlow API em http://localhost:${env.port}  ·  banco: ${db.kind}  ·  IA: ${ai.provider} (${ai.mode})`);
});

async function shutdown() {
  server.close();
  await closeRenderer();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
