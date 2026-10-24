import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_STYLES,
  DEFAULT_RULES_CONFIG,
  FORMAT_IDS,
  LAYOUT_FAMILIES,
  SEED_PRACAS,
  SEED_PRODUCTS,
  SEED_SEGMENTS,
  applyOps,
  buildCreativeDoc,
  buildSeedOffers,
  composeMessages,
  defaultMessages,
  validateMessages,
  deriveStatus,
  filterOps,
  validateCreative,
  type CopyVariant,
  type CreativeDoc,
  type RenderContext,
} from '../src';

const TODAY = '2026-10-20';
const offers = buildSeedOffers(TODAY);
const products = Object.fromEntries(SEED_PRODUCTS.map((p) => [p.sku, p]));

function ctxFor(praca: string, skus: string[], campaign = { startsAt: '2026-10-21', endsAt: '2026-10-27', name: 'Teste' }): RenderContext {
  return {
    products,
    offers: Object.fromEntries(skus.map((s) => [s, offers.find((o) => o.sku === s && o.praca === praca)])),
    praca: SEED_PRACAS.find((p) => p.code === praca)!,
    campaign,
    today: TODAY,
    legal: { mipWarning: DEFAULT_RULES_CONFIG.mipWarning },
  };
}

const variant: CopyVariant = {
  segmentId: 'geral',
  headline: 'Cuidado que cabe na sua rotina',
  shortHeadline: 'Cuidado na rotina',
  subheadline: 'Produtos para o dia a dia com a praticidade que você procura.',
  cta: 'Compre no app',
  badge: 'Clube Exemplo',
};

function build(format: (typeof FORMAT_IDS)[number], skus: string[], praca = 'PE', family: (typeof LAYOUT_FAMILIES)[number] = 'classico', bg: (typeof BACKGROUND_STYLES)[number] = 'circulos'): CreativeDoc {
  return buildCreativeDoc({ format, family, backgroundStyle: bg, variant, encarteHeadline: 'Semana do Autocuidado', skus, products, praca, segmentId: 'geral' });
}

describe('templates derivados', () => {
  for (const format of FORMAT_IDS) {
    for (const family of LAYOUT_FAMILIES) {
      for (const bg of BACKGROUND_STYLES) {
        it(`${format}/${family}/${bg} sai limpo (sem crítico e sem alerta)`, () => {
          const skus = format === 'encarte' ? ['SKU-1001', 'SKU-1004', 'SKU-1005', 'SKU-1006', 'SKU-1007', 'SKU-1010'] : ['SKU-1001'];
          const doc = build(format, skus, 'PE', family, bg);
          const report = validateCreative(doc, ctxFor('PE', skus));
          const failed = report.results.filter((r) => !r.passed && r.severity !== 'info');
          expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
        });
      }
    }
  }
});

describe('governança comercial', () => {
  it('bloqueia preço digitado em texto livre', () => {
    const doc = build('feed', ['SKU-1001']);
    const edited = applyOps(doc, [{ op: 'set', layerId: 'headline', path: 'text', value: 'Shampoo por R$ 19,90' }]);
    const r = validateCreative(edited, ctxFor('PE', ['SKU-1001']));
    expect(r.passed).toBe(false);
    expect(r.results.find((x) => x.ruleId === 'COM-004' && !x.passed)).toBeTruthy();
  });

  it('bloqueia praça sem oferta cadastrada e não inventa preço', () => {
    const doc = build('feed', ['SKU-1003'], 'CE');
    const r = validateCreative(doc, ctxFor('CE', ['SKU-1003']));
    expect(r.results.find((x) => x.ruleId === 'COM-001')?.passed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('bloqueia oferta vencida', () => {
    const doc = build('feed', ['SKU-1002'], 'BA');
    const r = validateCreative(doc, ctxFor('BA', ['SKU-1002']));
    expect(r.results.find((x) => x.ruleId === 'COM-002')?.passed).toBe(false);
  });

  it('bloqueia oferta de outra praça', () => {
    const doc = build('feed', ['SKU-1001'], 'PE');
    const ctx = ctxFor('PE', ['SKU-1001']);
    ctx.offers['SKU-1001'] = offers.find((o) => o.sku === 'SKU-1001' && o.praca === 'BA');
    const r = validateCreative(doc, ctx);
    expect(r.results.find((x) => x.ruleId === 'COM-006')?.passed).toBe(false);
  });

  it('filtro de patch recusa alterar preço, remover advertência e usar cor fora da paleta', () => {
    const doc = build('feed', ['SKU-1007']);
    const { allowed, rejected } = filterOps(doc, [
      { op: 'set', layerId: 'price', path: 'text', value: 'R$ 1,00' },
      { op: 'set', layerId: 'price', path: 'binding.sku', value: 'SKU-1001' },
      { op: 'remove', layerId: 'legal' },
      { op: 'set', layerId: 'headline', path: 'style.color', value: '#ff00ff' },
      { op: 'set', layerId: 'headline', path: 'text', value: 'Alívio para o seu dia' },
    ]);
    expect(allowed).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(rejected.filter((r) => r.protectedField)).toHaveLength(3);
  });
});

describe('governança regulatória e de marca', () => {
  it('MIP inclui advertência e passa; ocultá-la bloqueia', () => {
    const doc = build('stories', ['SKU-1007']);
    const ctx = ctxFor('PE', ['SKU-1007']);
    expect(validateCreative(doc, ctx).passed).toBe(true);
    const hidden = applyOps(doc, [{ op: 'set', layerId: 'legal', path: 'hidden', value: true }]);
    const r = validateCreative(hidden, ctx);
    expect(r.results.find((x) => x.ruleId === 'REG-002')?.passed).toBe(false);
  });

  it('bloqueia medicamento sob prescrição', () => {
    const doc = build('feed', ['SKU-1008']);
    expect(validateCreative(doc, ctxFor('PE', ['SKU-1008'])).results.find((x) => x.ruleId === 'REG-001')?.passed).toBe(false);
  });

  it('alerta medicamento para público com crianças', () => {
    const doc = build('feed', ['SKU-1007']);
    const r = validateCreative(doc, ctxFor('PE', ['SKU-1007']), { segment: SEED_SEGMENTS.find((s) => s.id === 'familia') });
    expect(r.results.find((x) => x.ruleId === 'REG-004')?.passed).toBe(false);
  });

  it('bloqueia termo proibido e alerta alegação não autorizada', () => {
    const doc = build('feed', ['SKU-1001']);
    const edited = applyOps(doc, [
      { op: 'set', layerId: 'headline', path: 'text', value: 'Resultado garantido' },
      { op: 'set', layerId: 'subheadline', path: 'text', value: 'Combate a queda dos fios' },
    ]);
    const r = validateCreative(edited, ctxFor('PE', ['SKU-1001']));
    expect(r.results.find((x) => x.ruleId === 'MAR-004')?.passed).toBe(false);
    expect(r.results.find((x) => x.ruleId === 'REG-003')?.passed).toBe(false);
  });

  it('aceita alegação autorizada do produto', () => {
    const doc = build('feed', ['SKU-1003']);
    const edited = applyOps(doc, [{ op: 'set', layerId: 'subheadline', path: 'text', value: 'Previne queimaduras solares no dia a dia' }]);
    const r = validateCreative(edited, ctxFor('PE', ['SKU-1003']));
    expect(r.results.find((x) => x.ruleId === 'REG-003')?.passed).toBe(true);
  });
});

describe('aprovação por conceito + exceção', () => {
  const ok = validateCreative(build('feed', ['SKU-1001']), ctxFor('PE', ['SKU-1001']));
  it('derivada limpa herda aprovação do conceito', () => {
    expect(deriveStatus({ origin: 'derivada', validation: ok, conceptApproved: true })).toBe('aprovado_por_heranca');
  });
  it('derivada aguarda conceito', () => {
    expect(deriveStatus({ origin: 'derivada', validation: ok, conceptApproved: false })).toBe('aguardando_conceito');
  });
  it('edição manual ou por IA vai para a fila de exceções', () => {
    expect(deriveStatus({ origin: 'manual', validation: ok, conceptApproved: true })).toBe('aguardando_revisao');
    expect(deriveStatus({ origin: 'ia', validation: ok, conceptApproved: true })).toBe('aguardando_revisao');
  });
  it('crítico bloqueia mesmo com aprovação registrada', () => {
    const bad = { ...ok, passed: false, counts: { ...ok.counts, critico: 1 } };
    expect(deriveStatus({ origin: 'ia', validation: bad, conceptApproved: true, decisionForVersion: 'aprovado' })).toBe('bloqueado');
  });
});

describe('textos por canal', () => {
  const msgs = defaultMessages(variant);
  it('reserva respeita os limites e passa nas regras', () => {
    expect(validateMessages(msgs, [products['SKU-1001']])).toEqual([]);
  });
  it('preço digitado no texto do canal é bloqueio crítico', () => {
    const r = validateMessages({ ...msgs, pushBody: 'Só hoje por R$ 9,90' }, [products['SKU-1001']]);
    expect(r.some((x) => x.ruleId === 'COM-004' && x.severity === 'critico')).toBe(true);
  });
  it('WhatsApp final recebe preço e vigência do cadastro, advertência de MIP e ignora SKU sem oferta', () => {
    const c = composeMessages(msgs, ctxFor('CE', ['SKU-1003', 'SKU-1007']), ['SKU-1003', 'SKU-1007'], 'https://exemplo.com.br');
    expect(c.missing).toHaveLength(1);
    expect(c.offerLines).toHaveLength(1);
    expect(c.whatsapp).toContain('R$');
    expect(c.whatsapp).toContain(DEFAULT_RULES_CONFIG.mipWarning);
    expect(c.whatsapp).toContain('Ofertas válidas');
  });
});
