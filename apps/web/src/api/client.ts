import type {
  Briefing,
  Concept,
  CreativeDoc,
  CreativeStatus,
  DiffEntry,
  FormatId,
  Offer,
  PatchOp,
  Praca,
  Product,
  RejectedOp,
  RulesConfig,
  RuleDefinition,
  Segment,
  UserRole,
  ValidationReport,
  VersionOrigin,
} from '@cf/shared';

/* ------------------------------ Tipos ----------------------------- */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
export interface SystemStatus {
  ai: { provider: string; mode: 'ia-generativa' | 'demonstracao'; requested: string };
  db: string;
  today: string;
  brandVersion: string;
  rulesVersion: string;
}
export interface ContextBundle {
  products: Record<string, Product>;
  offersByPraca: Record<string, Record<string, Offer | undefined>>;
  pracas: Praca[];
  today: string;
  legal: { mipWarning: string };
  campaign: { startsAt: string; endsAt: string; name: string };
}
export interface VersionDTO {
  id: string;
  number: number;
  origin: VersionOrigin;
  conceptId: string | null;
  authorId: string;
  instruction: string | null;
  status: CreativeStatus;
  createdAt: string;
  diff: DiffEntry[];
  rejected: RejectedOp[];
  validation: ValidationReport | null;
  doc: CreativeDoc;
}
export interface CreativeDTO {
  id: string;
  campaignId: string;
  format: FormatId;
  praca: string;
  segmentId: string;
  skus: string[];
  status: CreativeStatus;
  exceptionReason: string | null;
  updatedAt: string;
  current: VersionDTO | null;
}
export interface ConceptDTO {
  id: string;
  campaignId: string;
  number: number;
  data: Concept;
  source: string;
  status: 'proposto' | 'aprovado' | 'substituido' | 'reprovado';
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}
export interface CampaignDTO {
  id: string;
  name: string;
  briefing: Briefing;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  firstExportAt: string | null;
}
export interface CampaignOverview {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  firstExportAt: string | null;
  briefing: Briefing;
  total: number;
  byStatus: Partial<Record<CreativeStatus, number>>;
}
export interface CampaignDetail {
  campaign: CampaignDTO;
  concept: ConceptDTO | null;
  concepts: ConceptDTO[];
  creatives: CreativeDTO[];
  context: ContextBundle;
  exports: { id: string; fileName: string; count: number; createdAt: string; createdBy: string; blocked: number }[];
}
export interface AuditEvent {
  id: string;
  campaignId: string | null;
  creativeId: string | null;
  versionId: string | null;
  actorId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
export interface Review {
  id: string;
  creativeId: string | null;
  versionId: string | null;
  conceptId: string | null;
  reviewerId: string;
  decision: 'aprovado' | 'ajustes' | 'reprovado';
  comment: string | null;
  createdAt: string;
}
export interface CritiqueDTO {
  id: string;
  provider: string;
  fallback?: boolean;
  score: number;
  summary: string;
  strengths: string[];
  issues: { severity: 'baixa' | 'media' | 'alta'; text: string }[];
  suggestions: { text: string; instruction: string }[];
}
export interface CreativeDetail {
  creative: CreativeDTO;
  versions: VersionDTO[];
  reviews: Review[];
  audit: AuditEvent[];
  critique: { id: string; provider: string; data: Omit<CritiqueDTO, 'id' | 'provider'>; createdAt: string } | null;
  context: ContextBundle;
  concept: ConceptDTO | null;
}
export interface Proposal {
  proposalId: string;
  status: 'pendente' | 'recusada';
  summary: string;
  ops: PatchOp[];
  rejected: RejectedOp[];
  refusal: { category: string; message: string } | null;
  provider: string;
  fallback: boolean;
  ms?: number;
  previewDoc: CreativeDoc | null;
  diff: DiffEntry[];
  validation: ValidationReport | null;
}
export interface PreviewResult {
  totalPieces: number;
  breakdown: { pracas: number; segments: number; products: number; singleFormats: number; multiFormats: number };
  issues: { severity: 'critico' | 'alerta'; praca?: string; sku?: string; message: string }[];
}
export interface Metrics {
  campaign: { id: string; name: string; createdAt: string; firstExportAt: string | null };
  pieces: { total: number; byStatus: Partial<Record<CreativeStatus, number>>; byFormat: Record<string, number>; approved: number; inherited: number; inheritedRate: number };
  effort: { humanDecisions: number; piecesPerHumanDecision: number | null; generationSeconds: number; briefingToFirstExportMinutes: number | null };
  governance: Record<string, number>;
  gain: { baselineMinutesPerPiece: number | null; baselineNote: string; manualProjectionMinutes: number | null; measuredMinutes: number | null; multiplier: number | null };
}
export interface Learning {
  id: string;
  text: string;
  source: string;
  status: 'sugerida' | 'ativa' | 'descartada';
  createdBy: string;
  decidedBy: string | null;
  createdAt: string;
}
export interface QueueResponse {
  concepts: (ConceptDTO & { campaignName: string; pending: number })[];
  items: { creative: CreativeDTO; campaign: { id: string; name: string } | null; baseVersion: { id: string; number: number; doc: CreativeDoc } | null }[];
  contexts: Record<string, ContextBundle>;
}
export interface ImportReport {
  total: number;
  valid: number;
  errors: { line: number; message: string }[];
  offers: Offer[];
  saved: boolean;
  reevaluated?: number;
}

/* ------------------------------ Cliente --------------------------- */
const TOKEN_KEY = 'cf.token';
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return memToken;
  }
}
let memToken: string | null = null;
export function setToken(t: string | null) {
  memToken = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* armazenamento indisponível: mantém em memória */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith('/auth')) {
    setToken(null);
    if (!location.pathname.startsWith('/entrar')) location.href = '/entrar';
  }
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erro ${res.status}`, (data as { details?: unknown }).details);
  return data as T;
}

async function download(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (d as { error?: string }).error ?? 'Download bloqueado.');
  }
  const blob = await res.blob();
  const name = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const api = {
  users: () => req<User[]>('GET', '/auth/users'),
  login: (userId: string) => req<{ token: string; user: User }>('POST', '/auth/login', { userId }),
  me: () => req<User>('GET', '/me'),
  status: () => req<SystemStatus>('GET', '/system/status'),
  brand: () => req<{ version: string; colors: Record<string, string>; fonts: Record<string, { family: string }>; voice: { name: string; tone: string[]; doExamples: string[]; dontExamples: string[] }; rules: RuleDefinition[] }>('GET', '/system/brand'),

  catalog: () => req<{ products: Product[]; pracas: Praca[]; segments: Segment[] }>('GET', '/catalog'),
  offers: (praca?: string) => req<(Offer & { source: string; updatedAt: string })[]>('GET', `/offers${praca ? `?praca=${praca}` : ''}`),
  importOffers: (file: File, dryRun: boolean) => {
    const f = new FormData();
    f.append('file', file);
    return req<ImportReport>('POST', `/offers/import?dryRun=${dryRun ? 1 : 0}`, f, true);
  },
  downloadOffers: () => download('/offers/template.csv', 'ofertas.csv'),

  campaigns: () => req<CampaignOverview[]>('GET', '/campaigns'),
  preview: (b: unknown) => req<PreviewResult>('POST', '/campaigns/preview', b),
  createCampaign: (b: unknown) => req<CampaignDTO>('POST', '/campaigns', b),
  campaign: (id: string) => req<CampaignDetail>('GET', `/campaigns/${id}`),
  generateConcept: (id: string, feedback?: string) => req<{ concept: ConceptDTO; ai: { provider: string; fallback: boolean; ms: number } }>('POST', `/campaigns/${id}/concept/generate`, { feedback }),
  editConcept: (id: string, data: Concept) => req<ConceptDTO>('PUT', `/campaigns/${id}/concept`, data),
  generatePieces: (id: string) => req<{ total: number; created: number; updated: number; kept: number; statusCounts: Record<string, number>; ms: number }>('POST', `/campaigns/${id}/generate`, {}),
  revalidate: (id: string) => req<{ statusCounts: Record<string, number> }>('POST', `/campaigns/${id}/revalidate`, {}),
  audit: (id: string) => req<AuditEvent[]>('GET', `/campaigns/${id}/audit`),
  metrics: (id: string) => req<Metrics>('GET', `/campaigns/${id}/metrics`),
  exportCampaign: (id: string, body: { creativeIds?: string[]; pracas?: string[]; formats?: string[] }) =>
    req<{ exportId: string; fileName: string; count: number; blocked: { creativeId: string; file: string; status: string; reason: string }[] }>('POST', `/campaigns/${id}/export`, body),
  downloadExport: (exportId: string) => download(`/exports/${exportId}/download`, 'exportacao.zip'),

  creative: (id: string) => req<CreativeDetail>('GET', `/creatives/${id}`),
  manualEdit: (id: string, baseVersionId: string, ops: PatchOp[]) => req<{ version: VersionDTO; rejected: RejectedOp[] }>('PATCH', `/creatives/${id}/layers`, { baseVersionId, ops }),
  proposeAi: (id: string, instruction: string, scope: 'piece' | 'siblings') => req<Proposal>('POST', `/creatives/${id}/ai-edits`, { instruction, scope }),
  applyAi: (proposalId: string) => req<{ version: VersionDTO; replicated: { creativeId: string; praca: string; versionNumber: number; status: string }[] }>('POST', `/ai-edits/${proposalId}/apply`, {}),
  discardAi: (proposalId: string) => req<{ ok: true }>('POST', `/ai-edits/${proposalId}/discard`, {}),
  restore: (id: string, versionId: string) => req<{ version: VersionDTO }>('POST', `/creatives/${id}/restore`, { versionId }),
  validate: (id: string) => req<{ status: CreativeStatus; reason: string | null; validation: ValidationReport }>('POST', `/creatives/${id}/validate`, {}),
  critique: (id: string) => req<CritiqueDTO & { versionId: string }>('POST', `/creatives/${id}/critique`, {}),
  downloadPng: (id: string) => download(`/creatives/${id}/png`, 'peca.png'),

  queue: () => req<QueueResponse>('GET', '/reviews/queue'),
  reviewConcept: (id: string, decision: 'aprovado' | 'reprovado', comment?: string, suggestLearning?: boolean) => req<{ statusCounts: Record<string, number> }>('POST', `/concepts/${id}/review`, { decision, comment, suggestLearning }),
  reviewCreative: (id: string, versionId: string, decision: 'aprovado' | 'ajustes', comment?: string, suggestLearning?: boolean) =>
    req<{ status: CreativeStatus }>('POST', `/creatives/${id}/review`, { versionId, decision, comment, suggestLearning }),
  batchApprove: (creativeIds: string[]) => req<{ creativeId: string; ok: boolean; error?: string }[]>('POST', '/reviews/batch-approve', { creativeIds }),

  rules: () => req<{ config: RulesConfig; catalog: RuleDefinition[] }>('GET', '/admin/rules'),
  updateRules: (patch: Partial<RulesConfig>) => req<RulesConfig>('PUT', '/admin/rules', patch),
  settings: () => req<{ today: string; baseline: { minutesPerPiece: number | null; note: string } }>('GET', '/admin/settings'),
  updateSettings: (body: { simulatedToday?: string | null; baseline?: { minutesPerPiece: number | null; note: string } }) => req<{ today: string }>('PUT', '/admin/settings', body),
  learnings: () => req<Learning[]>('GET', '/learnings'),
  addLearning: (text: string) => req<{ id: string }>('POST', '/learnings', { text }),
  decideLearning: (id: string, status: 'ativa' | 'descartada') => req<{ ok: true }>('POST', `/learnings/${id}/decision`, { status }),
  resetDemo: () => req<{ ok: true }>('POST', '/admin/reset-demo', {}),
};
