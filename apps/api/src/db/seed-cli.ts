import { initDb } from './client';
import { seedDatabase } from './seed';

const reset = process.argv.includes('--reset');
const d = await initDb();
await seedDatabase({ reset });
console.log(`Base sintética carregada (${d.kind})${reset ? ' — histórico apagado' : ''}.`);
await d.close();
