/**
 * MANUAL DE MARCA SINTÉTICO, DERIVADO DE ESTUDO PÚBLICO (versionado)
 *
 * Paleta, tipografia e tom foram aproximados a partir da observação de materiais públicos
 * do cliente (identidade de 2025: vermelho e azul mais vivos, símbolo e letras arredondados,
 * tom acolhedor e otimista). Nome, logo e slogans continuam FICTÍCIOS: nada aqui é arquivo
 * oficial da marca. Critério, fontes e decisões: docs/MANUAL-DE-MARCA.md.
 * Para trocar a marca, altere apenas este arquivo: templates, editor, regras e IA leem tudo daqui.
 */

export const BRAND_VERSION = '2026.10-estudo-v2';

export const COLOR_TOKENS = {
  primary: '#1A62C4',
  primaryDark: '#0D3F86',
  primarySoft: '#DCE9FB',
  accent: '#E3202B',
  accentSoft: '#FDE1E2',
  sun: '#FFC72C',
  ink: '#14213D',
  muted: '#46536B',
  light: '#F3F7FD',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;
export const COLOR_TOKEN_NAMES = Object.keys(COLOR_TOKENS) as ColorToken[];

export const COLOR_LABELS: Record<ColorToken, string> = {
  primary: 'Azul da marca',
  primaryDark: 'Azul escuro',
  primarySoft: 'Azul suave',
  accent: 'Vermelho (preço)',
  accentSoft: 'Vermelho suave',
  sun: 'Ouro (selos e Clube)',
  ink: 'Texto',
  muted: 'Texto secundário',
  light: 'Fundo claro',
  white: 'Branco',
};

export const FONT_TOKENS = {
  display: { family: 'Nunito', fallback: 'Arial, sans-serif', avgCharWidth: 0.56 },
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
  name: 'Farmácia Exemplo (marca sintética inspirada no estudo do cliente)',
  tone: [
    'Acolhedor, humano e otimista ("alto astral"): fala de cuidado de perto, no dia a dia real das pessoas.',
    'Saúde acessível e próxima: a farmácia como parceira de todas as horas, sem tom técnico ou distante.',
    'Frases curtas; imperativo gentil ("Cuide", "Aproveite", "Garanta o seu", "Conte com a gente").',
    'Pode usar "a gente" e falar diretamente com "você"; evita jargão e linguagem de bula.',
    'Economia aparece como benefício para a família, nunca como grito de preço.',
    'Sem superlativos absolutos e sem promessas de resultado de saúde. No máximo um ponto de exclamação por peça.',
  ],
  doExamples: [
    'Cuidar de você faz parte do nosso dia',
    'Saúde pertinho de você, todo dia',
    'Seu autocuidado com a gente do lado',
    'Conte com a gente para cuidar da família',
  ],
  dontExamples: ['O MELHOR PREÇO DO BRASIL!!!', 'Cura a queda de cabelo', 'Resultado garantido', 'Corra, é só hoje!!!'],
};

/** Logo FICTÍCIO: símbolo arredondado com contorno (linguagem observada no estudo), sem copiar o símbolo real. */
function logoSvg(light: boolean): string {
  const c = COLOR_TOKENS;
  const disc = light ? '#FFFFFF' : c.primary;
  const plus = light ? c.primary : '#FFFFFF';
  const ring = light ? '#FFFFFF' : c.primary;
  const word = light ? '#FFFFFF' : c.primaryDark;
  const word2 = light ? c.sun : c.accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120"><circle cx="60" cy="60" r="55" fill="none" stroke="${ring}" stroke-width="5"/><circle cx="60" cy="60" r="44" fill="${disc}"/><rect x="51" y="34" width="18" height="52" rx="9" fill="${plus}"/><rect x="34" y="51" width="52" height="18" rx="9" fill="${plus}"/><circle cx="92" cy="26" r="9" fill="${light ? c.sun : c.accent}"/><text x="134" y="60" font-family="Nunito, Arial, sans-serif" font-weight="800" font-size="48" fill="${word}">Farmácia</text><text x="135" y="104" font-family="Nunito, Arial, sans-serif" font-weight="800" font-size="40" fill="${word2}">Exemplo</text></svg>`;
}

export const BRAND_LOGO_SVG = logoSvg(false);
export const BRAND_LOGO_LIGHT_SVG = logoSvg(true);
