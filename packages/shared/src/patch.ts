import { z } from 'zod';
import { COLOR_TOKEN_NAMES } from './brand/brand';
import { LayerSchema, ROLE_LABELS, type CreativeDoc, type Layer, type LayerRole } from './domain';

/**
 * Toda alteração (manual ou por IA) vira uma lista de operações. O servidor filtra
 * as operações contra a política de campos antes de gravar uma nova versão.
 */
export const PatchOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set'),
    layerId: z.string(),
    path: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.object({ op: z.literal('remove'), layerId: z.string() }),
  z.object({ op: z.literal('add'), layer: LayerSchema }),
]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

export interface RejectedOp {
  op: PatchOp;
  reason: string;
  /** true quando a operação tentou tocar dado comercial/legal protegido. */
  protectedField: boolean;
}

const GEOMETRY = ['x', 'y', 'w', 'h', 'z', 'hidden'];
const TEXT_STYLE = [
  'style.font',
  'style.fontSize',
  'style.fontWeight',
  'style.lineHeight',
  'style.letterSpacing',
  'style.uppercase',
  'style.italic',
  'style.align',
  'style.valign',
  'style.color',
  'style.bg',
  'style.radius',
  'style.padding',
];
const SHAPE_STYLE = ['style.fill', 'style.opacity', 'style.radius', 'style.shape'];
const COLOR_PATHS = ['style.color', 'style.bg', 'style.fill'];

/** Papéis cujo conteúdo é dado comercial ou legal — nunca editável em texto livre. */
export const PROTECTED_CONTENT_ROLES: LayerRole[] = ['price', 'validity', 'legal', 'product-name', 'product-image', 'logo'];
/** Papéis que não podem ser removidos da peça. */
const NON_REMOVABLE: LayerRole[] = ['price', 'validity', 'legal', 'logo', 'product-image', 'product-name', 'headline'];
const ADDABLE_ROLES: LayerRole[] = ['decor', 'extra-text', 'badge'];

export function allowedPaths(layer: Layer): string[] {
  if (layer.kind === 'shape') return [...GEOMETRY, ...SHAPE_STYLE];
  if (layer.kind === 'image' || layer.kind === 'logo') return [...GEOMETRY];
  if (layer.kind === 'price-tag') return [...GEOMETRY, 'style.bg', 'style.color', 'style.radius'];
  // texto
  if (layer.binding) return [...GEOMETRY, ...TEXT_STYLE];
  return [...GEOMETRY, 'text', ...TEXT_STYLE];
}

export function filterOps(doc: CreativeDoc, ops: PatchOp[]): { allowed: PatchOp[]; rejected: RejectedOp[] } {
  const allowed: PatchOp[] = [];
  const rejected: RejectedOp[] = [];
  const byId = new Map(doc.layers.map((l) => [l.id, l]));

  for (const op of ops) {
    if (op.op === 'add') {
      const l = op.layer;
      if (!ADDABLE_ROLES.includes(l.role) || l.binding || l.kind === 'price-tag' || l.kind === 'image') {
        rejected.push({ op, reason: `Não é permitido adicionar camada do tipo "${ROLE_LABELS[l.role]}" ou com dado vinculado.`, protectedField: !!l.binding || l.kind === 'price-tag' });
        continue;
      }
      if (byId.has(l.id)) {
        rejected.push({ op, reason: `Já existe uma camada com id ${l.id}.`, protectedField: false });
        continue;
      }
      const badColor = COLOR_PATHS.map((p) => (l.style as Record<string, unknown>)[p.slice(6)]).find(
        (c) => c !== undefined && !COLOR_TOKEN_NAMES.includes(c as never),
      );
      if (badColor) {
        rejected.push({ op, reason: `Cor fora da paleta da marca: ${String(badColor)}`, protectedField: false });
        continue;
      }
      allowed.push(op);
      continue;
    }

    const layer = byId.get(op.layerId);
    if (!layer) {
      rejected.push({ op, reason: `Camada "${op.layerId}" não existe nesta peça.`, protectedField: false });
      continue;
    }

    if (op.op === 'remove') {
      if (NON_REMOVABLE.includes(layer.role)) {
        rejected.push({
          op,
          reason: `A camada "${ROLE_LABELS[layer.role]}" é obrigatória e não pode ser removida.`,
          protectedField: PROTECTED_CONTENT_ROLES.includes(layer.role),
        });
      } else allowed.push(op);
      continue;
    }

    // set
    if (op.path === 'text' || op.path.startsWith('binding') || op.path === 'kind' || op.path === 'role' || op.path === 'id') {
      if (layer.binding || PROTECTED_CONTENT_ROLES.includes(layer.role)) {
        rejected.push({
          op,
          reason: `"${ROLE_LABELS[layer.role]}" vem do cadastro (${layer.binding?.source ?? 'marca'}) e não pode ser alterado aqui. Corrija na fonte de origem.`,
          protectedField: true,
        });
        continue;
      }
    }
    if (!allowedPaths(layer).includes(op.path)) {
      rejected.push({ op, reason: `Campo "${op.path}" não é editável em "${ROLE_LABELS[layer.role]}".`, protectedField: false });
      continue;
    }
    if (COLOR_PATHS.includes(op.path) && op.value !== null && !COLOR_TOKEN_NAMES.includes(op.value as never)) {
      rejected.push({ op, reason: `Cor fora da paleta da marca: ${String(op.value)}`, protectedField: false });
      continue;
    }
    if (op.path === 'text' && typeof op.value !== 'string') {
      rejected.push({ op, reason: 'Texto inválido.', protectedField: false });
      continue;
    }
    if (['x', 'y', 'w', 'h', 'style.fontSize'].includes(op.path) && typeof op.value !== 'number') {
      rejected.push({ op, reason: `Valor numérico esperado em ${op.path}.`, protectedField: false });
      continue;
    }
    allowed.push(op);
  }
  return { allowed, rejected };
}

function setPath(layer: Layer, path: string, value: unknown): Layer {
  const next: Layer = { ...layer, style: { ...layer.style } };
  if (path.startsWith('style.')) {
    const key = path.slice(6) as keyof Layer['style'];
    if (value === null) delete next.style[key];
    else (next.style as Record<string, unknown>)[key] = value;
  } else {
    let v = value;
    if (['x', 'y', 'w', 'h', 'z'].includes(path) && typeof v === 'number') v = Math.round(v);
    if ((path === 'w' || path === 'h') && typeof v === 'number') v = Math.max(4, v);
    (next as unknown as Record<string, unknown>)[path] = v;
  }
  return next;
}

export function applyOps(doc: CreativeDoc, ops: PatchOp[]): CreativeDoc {
  let layers = doc.layers.map((l) => ({ ...l, style: { ...l.style } }));
  for (const op of ops) {
    if (op.op === 'add') layers.push(op.layer);
    else if (op.op === 'remove') layers = layers.filter((l) => l.id !== op.layerId);
    else layers = layers.map((l) => (l.id === op.layerId ? setPath(l, op.path, op.value) : l));
  }
  return { ...doc, layers };
}

export interface DiffEntry {
  layerId: string;
  role: LayerRole | 'documento';
  field: string;
  from: unknown;
  to: unknown;
}

export function diffDocs(a: CreativeDoc, b: CreativeDoc): DiffEntry[] {
  const out: DiffEntry[] = [];
  const am = new Map(a.layers.map((l) => [l.id, l]));
  const bm = new Map(b.layers.map((l) => [l.id, l]));
  for (const [id, la] of am) {
    const lb = bm.get(id);
    if (!lb) {
      out.push({ layerId: id, role: la.role, field: 'camada', from: 'presente', to: 'removida' });
      continue;
    }
    for (const k of ['text', 'x', 'y', 'w', 'h', 'z', 'hidden'] as const) {
      if (la[k] !== lb[k]) out.push({ layerId: id, role: la.role, field: k, from: la[k], to: lb[k] });
    }
    const keys = new Set([...Object.keys(la.style), ...Object.keys(lb.style)]);
    for (const k of keys) {
      const va = (la.style as Record<string, unknown>)[k];
      const vb = (lb.style as Record<string, unknown>)[k];
      if (va !== vb) out.push({ layerId: id, role: la.role, field: `style.${k}`, from: va, to: vb });
    }
  }
  for (const [id, lb] of bm) if (!am.has(id)) out.push({ layerId: id, role: lb.role, field: 'camada', from: 'ausente', to: 'adicionada' });
  return out;
}

/** Mudança "criativa" = texto, inclusão/remoção de camada. Geometria e estilo também contam como edição humana. */
export function isCreativeChange(diff: DiffEntry[]): boolean {
  return diff.length > 0;
}
