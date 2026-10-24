import { SEMANTIC_CATEGORIES, type Briefing, type Concept, type CopyVariant, type CreativeDoc, type FormatSpec, type Product, type RulesConfig, type Segment, type SemanticText } from '@cf/shared';
import { z } from 'zod';

export interface ConceptInput {
  briefing: Briefing;
  products: Product[];
  segments: Segment[];
  rules: RulesConfig;
  learnings: string[];
  previous?: Concept;
  feedback?: string;
  /** Títulos aprovados pela equipe em campanhas anteriores (few-shot de estilo). */
  approvedExamples?: ApprovedExample[];
}

export interface ApprovedExample {
  campanha: string;
  objetivo: string;
  tema: string;
  titulo: string;
  subtitulo: string;
}

export interface LayerSummary {
  id: string;
  role: string;
  kind: string;
  text?: string;
  protected: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  style: Record<string, unknown>;
  allowedPaths: string[];
}

export interface EditInput {
  instruction: string;
  doc: CreativeDoc;
  layers: LayerSummary[];
  format: FormatSpec;
  variant?: CopyVariant;
  rules: RulesConfig;
  learnings: string[];
}

export const AiOpSchema = z.object({
  op: z.enum(['set', 'remove']),
  layerId: z.string(),
  path: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const EditResultSchema = z.object({
  summary: z.string().min(1).max(400),
  ops: z.array(AiOpSchema).max(30),
  refusal: z
    .object({
      category: z.enum(['dado_comercial', 'processo', 'fora_de_escopo', 'nao_entendi']),
      message: z.string(),
    })
    .nullable(),
});
export type EditResult = z.infer<typeof EditResultSchema>;

export interface CritiqueInput {
  png: Buffer;
  doc: CreativeDoc;
  format: FormatSpec;
  learnings: string[];
  textSummary: string;
}

export const CritiqueSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().max(500),
  strengths: z.array(z.string()).max(6),
  issues: z.array(z.object({ severity: z.enum(['baixa', 'media', 'alta']), text: z.string() })).max(8),
  suggestions: z.array(z.object({ text: z.string(), instruction: z.string() })).max(5),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export interface SemanticInput {
  texts: SemanticText[];
  products: Product[];
  segments: Segment[];
  learnings: string[];
  rules: RulesConfig;
}

export const SemanticResultSchema = z.object({
  findings: z.array(
    z.object({
      ref: z.string(),
      category: z.enum(SEMANTIC_CATEGORIES),
      excerpt: z.string(),
      explanation: z.string(),
      suggestion: z.string().nullable(),
    }),
  ),
});
export type SemanticResult = z.infer<typeof SemanticResultSchema>;

export interface AIProvider {
  name: string;
  generateConcept(input: ConceptInput): Promise<Concept>;
  interpretEdit(input: EditInput): Promise<EditResult>;
  critique(input: CritiqueInput): Promise<Critique>;
  semanticReview(input: SemanticInput): Promise<SemanticResult>;
}
