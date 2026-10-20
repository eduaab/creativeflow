import type { Offer, Praca, Product, Segment } from './domain';

/**
 * BASE SINTÉTICA. Todos os produtos, marcas e preços são fictícios.
 * Substituível pelas interfaces CatalogSource / OfferSource (ver apps/api/src/services/sources).
 */

export const SEED_PRACAS: Praca[] = [
  { code: 'CE', name: 'Ceará' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'BA', name: 'Bahia' },
];

export const SEED_SEGMENTS: Segment[] = [
  { id: 'geral', name: 'Público geral', description: 'Comunicação ampla, sem recorte específico.', badge: null, involvesChildren: false },
  { id: 'fidelidade', name: 'Clientes do programa de fidelidade', description: 'Clientes cadastrados que acompanham ofertas com frequência.', badge: 'Clube Exemplo', involvesChildren: false },
  { id: 'familia', name: 'Famílias com crianças', description: 'Rotina da casa, praticidade, cuidado com os pequenos.', badge: 'Para a família', involvesChildren: true },
  { id: '60mais', name: 'Público 60+', description: 'Clareza, leitura confortável, cuidado contínuo.', badge: null, involvesChildren: false },
];

export const SEED_PRODUCTS: Product[] = [
  { sku: 'SKU-1001', name: 'Shampoo Hidratante 300 ml', brand: 'Linha Exemplo', category: 'higiene', description: 'Shampoo para uso diário.', claims: ['hidratação dos fios'], image: { type: 'packshot', shape: 'bottle', color: '#5BB5C8' } },
  { sku: 'SKU-1002', name: 'Condicionador Hidratante 300 ml', brand: 'Linha Exemplo', category: 'higiene', description: 'Condicionador para uso diário.', claims: ['hidratação dos fios', 'maciez'], image: { type: 'packshot', shape: 'bottle', color: '#8FC9A8' } },
  { sku: 'SKU-1003', name: 'Protetor Solar FPS 50 120 ml', brand: 'Derma Exemplo', category: 'dermocosmetico', description: 'Proteção solar para o corpo.', claims: ['proteção UVA/UVB', 'previne queimaduras solares'], image: { type: 'packshot', shape: 'tube', color: '#F2A541' } },
  { sku: 'SKU-1004', name: 'Sabonete Líquido Infantil 200 ml', brand: 'Kids Exemplo', category: 'infantil', description: 'Sabonete suave para crianças.', claims: ['fórmula suave'], image: { type: 'packshot', shape: 'pump', color: '#F6B5C4' } },
  { sku: 'SKU-1005', name: 'Hidratante Corporal 400 ml', brand: 'Linha Exemplo', category: 'beleza', description: 'Loção hidratante para o corpo.', claims: ['hidratação por 24h'], image: { type: 'packshot', shape: 'pump', color: '#C9B6E4' } },
  { sku: 'SKU-1006', name: 'Vitamina C 1 g com 30 comprimidos', brand: 'Vitta Exemplo', category: 'suplemento', description: 'Suplemento alimentar de vitamina C.', claims: [], image: { type: 'packshot', shape: 'jar', color: '#F5C542' } },
  { sku: 'SKU-1007', name: 'Paracetamol 750 mg com 20 comprimidos', brand: 'Linha Exemplo', category: 'mip', description: 'Analgésico e antitérmico. Medicamento isento de prescrição (exemplo).', claims: [], image: { type: 'packshot', shape: 'box', color: '#6FA8DC' } },
  { sku: 'SKU-1008', name: 'Amoxicilina 500 mg com 21 cápsulas', brand: 'Linha Exemplo', category: 'rx', description: 'Antibiótico. Venda sob prescrição (exemplo para teste de bloqueio).', claims: [], image: { type: 'packshot', shape: 'box', color: '#B0B7BB' } },
  { sku: 'SKU-1009', name: 'Escova Dental Macia', brand: 'Linha Exemplo', category: 'higiene', description: 'Escova de cerdas macias.', claims: [], image: { type: 'none' } },
  { sku: 'SKU-1010', name: 'Fralda Infantil G com 30 unidades', brand: 'Kids Exemplo', category: 'infantil', description: 'Fralda descartável tamanho G.', claims: [], image: { type: 'packshot', shape: 'box', color: '#7EC8E3' } },
];

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Preços fictícios por praça (centavos): [CE, PE, BA]. null = sem oferta cadastrada. */
const PRICE_TABLE: Record<string, [number | null, number | null, number | null, number | null]> = {
  // sku: [CE, PE, BA, preço "de"]
  'SKU-1001': [2390, 2490, 2190, 2990],
  'SKU-1002': [2590, 2690, 2390, 3190],
  'SKU-1003': [null, 5990, 5790, 7490],
  'SKU-1004': [1890, 1990, 1790, null],
  'SKU-1005': [3290, 3490, 3190, 4290],
  'SKU-1006': [2990, 3190, 2890, null],
  'SKU-1007': [990, 1090, 950, null],
  'SKU-1008': [3990, 4190, 3890, null],
  'SKU-1009': [690, 790, 650, 990],
  'SKU-1010': [5490, 5690, 5290, 6490],
};

/** Gera ofertas relativas a "hoje" para a demo nunca expirar sozinha. */
export function buildSeedOffers(today = todayISO()): Offer[] {
  const start = addDays(today, -2);
  const end = addDays(today, 30);
  const out: Offer[] = [];
  for (const [sku, [ce, pe, ba, list]] of Object.entries(PRICE_TABLE)) {
    (['CE', 'PE', 'BA'] as const).forEach((praca, i) => {
      const price = [ce, pe, ba][i];
      if (price == null) return;
      const expired = sku === 'SKU-1002' && praca === 'BA';
      out.push({
        id: `OF-${sku.slice(4)}-${praca}`,
        sku,
        praca,
        priceCents: price,
        listPriceCents: list,
        startsAt: expired ? addDays(today, -20) : start,
        endsAt: expired ? addDays(today, -1) : end,
        conditions: 'ou enquanto durarem os estoques',
        status: 'ativa',
      });
    });
  }
  return out;
}

export const SEED_USERS = [
  { id: 'u-ana', name: 'Ana Souza', email: 'ana@exemplo.com', role: 'criador' as const },
  { id: 'u-rui', name: 'Rui Lima', email: 'rui@exemplo.com', role: 'revisor' as const },
  { id: 'u-bia', name: 'Bia Costa', email: 'bia@exemplo.com', role: 'admin' as const },
];
