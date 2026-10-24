import { Router } from 'express';
import multer from 'multer';
import {
  AdminController as Admin,
  AuthController as Auth,
  CampaignController as Campaign,
  CatalogController as Catalog,
  CreativeController as Creative,
  ReviewController as Review,
  SystemController as System,
} from '../controllers';
import { authenticate, requireRole } from '../middleware/auth';
import { ah } from '../middleware/error';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const CRIA = requireRole('criador');
const REVISA = requireRole('revisor');
const ADMIN = requireRole('admin');

export function apiRouter(): Router {
  const r = Router();

  // públicas
  r.get('/health', (_req, res) => res.json({ ok: true }));
  r.get('/auth/users', ah(Auth.users));
  r.post('/auth/login', ah(Auth.login));

  r.use(ah(authenticate));
  r.get('/me', ah(Auth.me));
  r.get('/system/status', ah(System.status));
  r.get('/system/brand', ah(System.brand));

  // catálogo e ofertas (fonte comercial)
  r.get('/catalog', ah(Catalog.catalog));
  r.get('/offers', ah(Catalog.offers));
  r.get('/offers/template.csv', ah(Catalog.offersTemplate));
  r.post('/offers/import', ADMIN, upload.single('file'), ah(Catalog.importOffers));

  // campanhas
  r.get('/campaigns', ah(Campaign.list));
  r.post('/campaigns/preview', ah(Campaign.preview));
  r.post('/campaigns', CRIA, ah(Campaign.create));
  r.get('/campaigns/:id', ah(Campaign.detail));
  r.post('/campaigns/:id/concept/generate', CRIA, ah(Campaign.generateConcept));
  r.put('/campaigns/:id/concept', CRIA, ah(Campaign.editConcept));
  r.get('/campaigns/:id/messages', ah(Campaign.messages));
  r.post('/campaigns/:id/generate', CRIA, ah(Campaign.generatePieces));
  r.post('/campaigns/:id/revalidate', ah(Campaign.revalidate));
  r.get('/campaigns/:id/audit', ah(Campaign.audit));
  r.get('/campaigns/:id/metrics', ah(Campaign.metrics));
  r.post('/campaigns/:id/export', ah(Campaign.export));
  r.get('/exports/:exportId/download', ah(Campaign.download));

  // peças (estúdio)
  r.get('/creatives/:id', ah(Creative.detail));
  r.get('/versions/:versionId', ah(Creative.version));
  r.patch('/creatives/:id/layers', CRIA, ah(Creative.manualEdit));
  r.post('/creatives/:id/ai-edits', CRIA, ah(Creative.proposeAi));
  r.post('/ai-edits/:proposalId/apply', CRIA, ah(Creative.applyAi));
  r.post('/ai-edits/:proposalId/discard', CRIA, ah(Creative.discardAi));
  r.post('/creatives/:id/restore', CRIA, ah(Creative.restore));
  r.post('/creatives/:id/validate', ah(Creative.validate));
  r.post('/creatives/:id/critique', ah(Creative.critique));
  r.get('/creatives/:id/png', ah(Creative.png));

  // revisão e aprovação
  r.get('/reviews/queue', ah(Review.queue));
  r.post('/concepts/:id/review', REVISA, ah(Review.concept));
  r.post('/creatives/:id/review', REVISA, ah(Review.creative));
  r.post('/reviews/batch-approve', REVISA, ah(Review.batch));

  // administração
  r.get('/admin/rules', ah(Admin.rules));
  r.put('/admin/rules', ADMIN, ah(Admin.updateRules));
  r.get('/admin/settings', ah(Admin.settings));
  r.put('/admin/settings', ADMIN, ah(Admin.updateSettings));
  r.get('/learnings', ah(Admin.learnings));
  r.post('/learnings', ADMIN, ah(Admin.addLearning));
  r.post('/learnings/:id/decision', ADMIN, ah(Admin.decideLearning));
  r.post('/admin/reset-demo', ADMIN, ah(Admin.resetDemo));

  return r;
}
