/**
 * MANUAL DE MARCA SINTÉTICO (versionado)
 *
 * Valores provisórios e propositalmente neutros. O critério de construção do manual
 * (fontes públicas observadas, data, decisão tomada) fica em docs/MANUAL-DE-MARCA.md.
 * Para trocar a marca, altere apenas este arquivo: templates, editor, regras e IA
 * leem tudo daqui.
 */

export const BRAND_VERSION = '2026.10-sintetico-v1';

export const COLOR_TOKENS = {
  primary: '#0E5E6F',
  primaryDark: '#0A4553',
  primarySoft: '#D6EEEC',
  accent: '#E8530A',
  accentSoft: '#FDE3D3',
  sun: '#FFC93C',
  ink: '#13262B',
  muted: '#41545A',
  light: '#F4FAF9',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;
export const COLOR_TOKEN_NAMES = Object.keys(COLOR_TOKENS) as ColorToken[];

export const COLOR_LABELS: Record<ColorToken, string> = {
  primary: 'Primária',
  primaryDark: 'Primária escura',
  primarySoft: 'Primária suave',
  accent: 'Destaque (preço)',
  accentSoft: 'Destaque suave',
  sun: 'Sol',
  ink: 'Texto',
  muted: 'Texto secundário',
  light: 'Fundo claro',
  white: 'Branco',
};

export const FONT_TOKENS = {
  display: { family: 'Poppins', fallback: 'Arial, sans-serif', avgCharWidth: 0.62 },
  body: { family: 'Inter', fallback: 'Arial, sans-serif', avgCharWidth: 0.52 },
} as const;

export type FontToken = keyof typeof FONT_TOKENS;

export function cssFont(token: FontToken | undefined): string {
  const f = FONT_TOKENS[token ?? 'body'];
  return `'${f.family}', ${f.fallback}`;
}

export function hex(token: string | undefined, fallback: ColorToken = 'ink'): string {
  if (token && token in COLOR_TOKENS) return COLOR_TOKENS[token as ColorToken];
  return COLOR_TOKENS[fallback];
}

/** Diretrizes verbais enviadas à IA em todo pedido (contexto, não treinamento). */
export const BRAND_VOICE = {
  name: 'Farmácia Exemplo (marca sintética)',
  tone: [
    'Claro, acolhedor e objetivo; fala de cuidado no dia a dia.',
    'Frases curtas; verbo no imperativo gentil ("Cuide", "Aproveite", "Garanta o seu").',
    'Sem exageros, sem superlativos absolutos e sem promessas de resultado de saúde.',
    'No máximo um ponto de exclamação por peça.',
  ],
  doExamples: [
    'Cuidado que cabe na rotina',
    'Seu momento de autocuidado começa aqui',
    'Pele protegida todos os dias',
  ],
  dontExamples: ['O MELHOR PREÇO DO BRASIL!!!', 'Cura a queda de cabelo', 'Resultado garantido'],
};

export const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120"><rect x="0" y="10" width="100" height="100" rx="26" fill="${COLOR_TOKENS.primary}"/><rect x="40" y="28" width="20" height="64" rx="6" fill="#fff"/><rect x="18" y="50" width="64" height="20" rx="6" fill="#fff"/><text x="122" y="62" font-family="Poppins, Arial, sans-serif" font-weight="700" font-size="46" fill="${COLOR_TOKENS.primaryDark}">Farmácia</text><text x="124" y="104" font-family="Poppins, Arial, sans-serif" font-weight="600" font-size="34" fill="${COLOR_TOKENS.accent}" letter-spacing="6">EXEMPLO</text></svg>`;

export const BRAND_LOGO_LIGHT_SVG = BRAND_LOGO_SVG.replace(
  `fill="${COLOR_TOKENS.primaryDark}"`,
  'fill="#FFFFFF"',
);
