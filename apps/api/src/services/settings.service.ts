import { DEFAULT_RULES_CONFIG, RulesConfig, todayISO } from '@cf/shared';
import { z } from 'zod';
import { getSetting, setSetting } from '../models/governance.model';

export async function getRulesConfig(): Promise<RulesConfig> {
  const stored = await getSetting<Partial<RulesConfig>>('rulesConfig');
  return { ...DEFAULT_RULES_CONFIG, ...(stored ?? {}) };
}

export const RulesConfigPatchSchema = z
  .object({
    forbiddenTerms: z.array(z.string().min(2)).max(200),
    claimTerms: z.array(z.string().min(2)).max(200),
    mipWarning: z.string().min(10).max(200),
    contrastMin: z.number().min(1).max(21),
    contrastMinLarge: z.number().min(1).max(21),
    logoMinWidthRatio: z.number().min(0.02).max(0.6),
    maxExclamations: z.number().int().min(0).max(5),
    blockRx: z.boolean(),
  })
  .partial();

export async function updateRulesConfig(patch: z.infer<typeof RulesConfigPatchSchema>): Promise<RulesConfig> {
  const current = await getRulesConfig();
  const [y, m] = new Date().toISOString().slice(0, 7).split('-');
  const next = { ...current, ...patch, version: `regras-${y}.${m}-r${Date.now().toString(36)}` };
  await setSetting('rulesConfig', next);
  return next;
}

/** Data de referência para vigência. Pode ser simulada (ex.: mostrar oferta vencendo durante a revisão). */
export async function getToday(): Promise<string> {
  return (await getSetting<string>('simulatedToday')) || todayISO();
}
export async function setSimulatedToday(date: string | null) {
  await setSetting('simulatedToday', date ?? '');
}

/** Tempo medido pela equipe para produzir UMA adaptação manualmente (minutos). */
export async function getBaseline(): Promise<{ minutesPerPiece: number | null; note: string }> {
  return (await getSetting('baseline')) ?? { minutesPerPiece: null, note: '' };
}
export async function setBaseline(v: { minutesPerPiece: number | null; note: string }) {
  await setSetting('baseline', v);
}
