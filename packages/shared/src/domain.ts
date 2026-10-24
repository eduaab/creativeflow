import { z } from 'zod';
import { COLOR_TOKEN_NAMES } from './brand/brand';

/* ------------------------------------------------------------------ */
/* Catálogo, ofertas e praças (dados comerciais — fonte da verdade)     */
/* ------------------------------------------------------------------ */

export const PRODUCT_CATEGORIES = [
  'higiene',
  'beleza',
  'dermocosmetico',
  'infantil',
  'suplemento',
  'mip',
  'rx',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  higiene: 'Higiene pessoal',
  beleza: 'Beleza',
  dermocosmetico: 'Dermocosmético',
  infantil: 'Infantil',
  suplemento: 'Suplemento alimentar',
  mip: 'Medicamento isento de prescrição',
  rx: 'Medicamento sob prescrição',
};

export const PackshotShapeSchema = z.enum(['bottle', 'pump', 'tube', 'box', 'jar', 'blister']);
export type PackshotShape = z.infer<typeof PackshotShapeSchema>;

export const ProductImageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('packshot'), shape: PackshotShapeSchema, color: z.string() }),
  z.object({ type: z.literal('url'), src: z.string() }),
  z.object({ type: z.literal('none') }),
]);
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default('Linha Exemplo'),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().default(''),
  /** Alegações autorizadas para o produto (texto livre não pode ir além delas). */
  claims: z.array(z.string()).default([]),
  image: ProductImageSchema,
});
export type Product = z.infer<typeof ProductSchema>;

export const PracaSchema = z.object({ code: z.string().length(2), name: z.string() });
export type Praca = z.infer<typeof PracaSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  sku: z.string(),
  praca: z.string().length(2),
  /** Preço em centavos. */
  priceCents: z.number().int().positive(),
  listPriceCents: z.number().int().positive().nullable().default(null),
  startsAt: z.string(), // YYYY-MM-DD
  endsAt: z.string(), // YYYY-MM-DD
  conditions: z.string().default('ou enquanto durarem os estoques'),
  status: z.enum(['ativa', 'inativa']).default('ativa'),
});
export type Offer = z.infer<typeof OfferSchema>;

export const SegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** Selo opcional exibido na peça (texto criativo). */
  badge: z.string().nullable().default(null),
  /** Segmento que envolve crianças (afeta regras de medicamento). */
  involvesChildren: z.boolean().default(false),
});
export type Segment = z.infer<typeof SegmentSchema>;

/* ------------------------------------------------------------------ */
/* Formatos e canais                                                    */
/* ------------------------------------------------------------------ */

export type Orientation = 'square' | 'portrait' | 'tall' | 'wide' | 'sheet';

export interface FormatSpec {
  id: FormatId;
  label: string;
  channel: string;
  width: number;
  height: number;
  orientation: Orientation;
  /** Área segura (px) — fora dela a interface do canal pode cobrir o conteúdo. */
  safe: { top: number; right: number; bottom: number; left: number };
  maxHeadline: number;
  maxSubheadline: number;
  multiProduct: boolean;
}

export const FORMAT_IDS = ['feed', 'retrato', 'stories', 'banner', 'encarte'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const FORMATS: Record<FormatId, FormatSpec> = {
  feed: {
    id: 'feed',
    label: 'Feed quadrado',
    channel: 'Instagram / Facebook',
    width: 1080,
    height: 1080,
    orientation: 'square',
    safe: { top: 40, right: 54, bottom: 24, left: 54 },
    maxHeadline: 48,
    maxSubheadline: 90,
    multiProduct: false,
  },
  retrato: {
    id: 'retrato',
    label: 'Feed retrato',
    channel: 'Instagram / WhatsApp',
    width: 1080,
    height: 1350,
    orientation: 'portrait',
    safe: { top: 40, right: 54, bottom: 24, left: 54 },
    maxHeadline: 56,
    maxSubheadline: 100,
    multiProduct: false,
  },
  stories: {
    id: 'stories',
    label: 'Stories',
    channel: 'Instagram / WhatsApp Status',
    width: 1080,
    height: 1920,
    orientation: 'tall',
    safe: { top: 250, right: 64, bottom: 340, left: 64 },
    maxHeadline: 40,
    maxSubheadline: 80,
    multiProduct: false,
  },
  banner: {
    id: 'banner',
    label: 'Banner site / app',
    channel: 'E-commerce',
    width: 1920,
    height: 600,
    orientation: 'wide',
    safe: { top: 24, right: 40, bottom: 18, left: 40 },
    maxHeadline: 42,
    maxSubheadline: 80,
    multiProduct: false,
  },
  encarte: {
    id: 'encarte',
    label: 'Encarte digital',
    channel: 'Site / WhatsApp / impresso',
    width: 1240,
    height: 1754,
    orientation: 'sheet',
    safe: { top: 40, right: 40, bottom: 30, left: 40 },
    maxHeadline: 44,
    maxSubheadline: 90,
    multiProduct: true,
  },
};

/* ------------------------------------------------------------------ */
/* Briefing e conceito                                                  */
/* ------------------------------------------------------------------ */

export const LAYOUT_FAMILIES = ['classico', 'destaque', 'faixa'] as const;
export type LayoutFamily = (typeof LAYOUT_FAMILIES)[number];
export const BACKGROUND_STYLES = ['solido', 'circulos', 'blocos'] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

export const BriefingSchema = z.object({
  name: z.string().min(3, 'Dê um nome à campanha'),
  objective: z.string().min(5, 'Descreva o objetivo'),
  tone: z.string().default('claro e acolhedor'),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pracas: z.array(z.string().length(2)).min(1, 'Escolha ao menos uma praça'),
  formats: z.array(z.enum(FORMAT_IDS)).min(1, 'Escolha ao menos um formato'),
  segments: z.array(z.string()).min(1, 'Escolha ao menos um público'),
  skus: z.array(z.string()).min(1, 'Escolha ao menos um produto'),
  ctaLabel: z.string().default('Compre no app'),
  ctaUrl: z.string().default('https://exemplo.com.br/ofertas'),
  restrictions: z.string().default(''),
  layoutFamily: z.enum(['auto', ...LAYOUT_FAMILIES]).default('auto'),
});
export type Briefing = z.infer<typeof BriefingSchema>;

export const CopyVariantSchema = z.object({
  segmentId: z.string(),
  headline: z.string().min(3).max(80),
  shortHeadline: z.string().min(3).max(44),
  subheadline: z.string().min(3).max(140),
  cta: z.string().min(2).max(24),
  badge: z.string().max(24).nullable(),
});
export type CopyVariant = z.infer<typeof CopyVariantSchema>;

/** Saída exigida da IA para o conceito-base da campanha. */
export const ConceptSchema = z.object({
  theme: z.string().min(3).max(80),
  rationale: z.string().min(3).max(600),
  layoutFamily: z.enum(LAYOUT_FAMILIES),
  backgroundStyle: z.enum(BACKGROUND_STYLES),
  encarteHeadline: z.string().min(3).max(60),
  variants: z.array(CopyVariantSchema).min(1),
});
export type Concept = z.infer<typeof ConceptSchema>;

/* ------------------------------------------------------------------ */
/* Documento da peça (camadas)                                          */
/* ------------------------------------------------------------------ */

export const LAYER_ROLES = [
  'decor',
  'card',
  'logo',
  'badge',
  'headline',
  'subheadline',
  'cta',
  'product-image',
  'product-name',
  'price',
  'validity',
  'legal',
  'extra-text',
] as const;
export type LayerRole = (typeof LAYER_ROLES)[number];

export const ROLE_LABELS: Record<LayerRole, string> = {
  decor: 'Ornamento',
  card: 'Cartão',
  logo: 'Logo',
  badge: 'Selo',
  headline: 'Título',
  subheadline: 'Subtítulo',
  cta: 'Chamada (CTA)',
  'product-image': 'Imagem do produto',
  'product-name': 'Nome do produto',
  price: 'Preço',
  validity: 'Vigência',
  legal: 'Advertência legal',
  'extra-text': 'Texto livre',
};

const ColorTokenSchema = z.enum(COLOR_TOKEN_NAMES as [string, ...string[]]);

export const LayerStyleSchema = z
  .object({
    font: z.enum(['display', 'body']).optional(),
    fontSize: z.number().min(6).max(600).optional(),
    fontWeight: z.number().min(300).max(900).optional(),
    lineHeight: z.number().min(0.8).max(2).optional(),
    letterSpacing: z.number().min(-5).max(20).optional(),
    uppercase: z.boolean().optional(),
    italic: z.boolean().optional(),
    strike: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
    color: ColorTokenSchema.optional(),
    bg: ColorTokenSchema.optional(),
    fill: ColorTokenSchema.optional(),
    radius: z.number().min(0).max(2000).optional(),
    opacity: z.number().min(0).max(1).optional(),
    padding: z.number().min(0).max(200).optional(),
    shape: z.enum(['rect', 'circle']).optional(),
  })
  .strict();
export type LayerStyle = z.infer<typeof LayerStyleSchema>;

export const BindingSchema = z.object({
  source: z.enum(['offer', 'product', 'legal']),
  sku: z.string().optional(),
  field: z.string(),
});
export type Binding = z.infer<typeof BindingSchema>;

export const LayerSchema = z.object({
  id: z.string(),
  role: z.enum(LAYER_ROLES),
  kind: z.enum(['shape', 'text', 'image', 'logo', 'price-tag']),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  z: z.number().int(),
  hidden: z.boolean().optional(),
  /** Apenas camadas de texto criativo têm `text`. Dados comerciais vêm de `binding`. */
  text: z.string().optional(),
  binding: BindingSchema.optional(),
  style: LayerStyleSchema.default({}),
});
export type Layer = z.infer<typeof LayerSchema>;

export const CreativeDocSchema = z.object({
  format: z.enum(FORMAT_IDS),
  width: z.number(),
  height: z.number(),
  background: ColorTokenSchema,
  layers: z.array(LayerSchema),
  meta: z.object({
    family: z.enum(LAYOUT_FAMILIES),
    backgroundStyle: z.enum(BACKGROUND_STYLES),
    praca: z.string(),
    segmentId: z.string(),
    skus: z.array(z.string()),
    brandVersion: z.string(),
  }),
});
export type CreativeDoc = z.infer<typeof CreativeDocSchema>;

/* ------------------------------------------------------------------ */
/* Contexto de renderização/validação                                   */
/* ------------------------------------------------------------------ */

export interface RenderContext {
  products: Record<string, Product>;
  /** Ofertas da praça da peça, indexadas por SKU. */
  offers: Record<string, Offer | undefined>;
  praca: Praca;
  campaign: { startsAt: string; endsAt: string; name: string };
  /** Data de referência para vigência (permite simular "hoje" na demo). */
  today: string;
  legal: { mipWarning: string };
}

/* ------------------------------------------------------------------ */
/* Status da peça e governança                                          */
/* ------------------------------------------------------------------ */

export const CREATIVE_STATUSES = [
  'rascunho',
  'bloqueado',
  'aguardando_conceito',
  'aguardando_revisao',
  'ajustes_solicitados',
  'aprovado',
  'aprovado_por_heranca',
] as const;
export type CreativeStatus = (typeof CREATIVE_STATUSES)[number];

export const STATUS_LABELS: Record<CreativeStatus, string> = {
  rascunho: 'Rascunho',
  bloqueado: 'Bloqueado',
  aguardando_conceito: 'Aguardando conceito',
  aguardando_revisao: 'Aguardando revisão',
  ajustes_solicitados: 'Ajustes solicitados',
  aprovado: 'Aprovado',
  aprovado_por_heranca: 'Aprovado por herança',
};

export const APPROVED_STATUSES: CreativeStatus[] = ['aprovado', 'aprovado_por_heranca'];

export type VersionOrigin = 'derivada' | 'manual' | 'ia';

export const ROLES = ['criador', 'revisor', 'admin'] as const;
export type UserRole = (typeof ROLES)[number];
