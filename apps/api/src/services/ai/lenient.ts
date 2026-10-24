import { wordsShorten } from '@cf/shared';
import { z } from 'zod';

/**
 * Esquemas TOLERANTES para respostas de LLM: em vez de rejeitar a resposta inteira porque
 * um título passou 3 caracteres do limite, ajustam o valor. O resultado é validado de novo
 * pelos esquemas estritos do domínio antes de virar conceito ou versão.
 */
const clip = (n: number) => z.string().transform((s) => wordsShorten(s.trim().replace(/\s+/g, ' '), n));
const cut = (n: number) => z.string().transform((s) => s.trim().slice(0, n));

export const LenientConceptSchema = z.object({
  theme: clip(80),
  rationale: cut(600),
  layoutFamily: z.string().transform((v) => (v === 'destaque' ? 'destaque' : 'classico') as 'destaque' | 'classico'),
  backgroundStyle: z.string().transform((v) => (['solido', 'circulos', 'blocos'].includes(v) ? v : 'circulos') as 'solido' | 'circulos' | 'blocos'),
  encarteHeadline: clip(60),
  variants: z
    .array(
      z.object({
        segmentId: z.string(),
        headline: clip(80),
        shortHeadline: clip(44),
        subheadline: clip(140),
        cta: clip(24),
        badge: z
          .string()
          .nullable()
          .optional()
          .transform((b) => (b && b.trim() ? wordsShorten(b.trim(), 24) : null)),
      }),
    )
    .min(1),
});

const CATEGORIES = ['dado_comercial', 'processo', 'fora_de_escopo', 'nao_entendi'] as const;
export const LenientEditSchema = z.object({
  summary: cut(400),
  ops: z
    .array(
      z.object({
        op: z.enum(['set', 'remove']),
        layerId: z.string(),
        path: z.string().optional(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
      }),
    )
    .default([])
    .transform((a) => a.slice(0, 30)),
  refusal: z
    .object({ category: z.string(), message: z.string() })
    .nullable()
    .optional()
    .transform((r) => (r ? { category: (CATEGORIES as readonly string[]).includes(r.category) ? (r.category as (typeof CATEGORIES)[number]) : 'fora_de_escopo', message: r.message } : null)),
});

const SEV = ['baixa', 'media', 'alta'] as const;
export const LenientCritiqueSchema = z.object({
  score: z.coerce.number().transform((n) => Math.max(0, Math.min(100, Math.round(n)))),
  summary: cut(500),
  strengths: z.array(z.string()).default([]).transform((a) => a.slice(0, 6)),
  issues: z
    .array(z.object({ severity: z.string(), text: z.string() }))
    .default([])
    .transform((a) => a.slice(0, 8).map((i) => ({ severity: ((SEV as readonly string[]).includes(i.severity) ? i.severity : 'media') as (typeof SEV)[number], text: i.text }))),
  suggestions: z
    .array(z.object({ text: z.string(), instruction: z.string() }))
    .default([])
    .transform((a) => a.slice(0, 5)),
});
