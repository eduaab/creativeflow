import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRouter());
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(errorHandler);

  // Em produção a API também serve o front-end buildado (um único container).
  if (existsSync(env.webDist)) {
    app.use(express.static(env.webDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(join(env.webDist, 'index.html')));
  }
  return app;
}
