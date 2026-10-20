import { FONT_TOKENS, type FontToken } from './brand/brand';

/**
 * Estimativa determinística de quebra de linha. Usada na geração (para escolher o
 * tamanho de fonte) e na validação (alerta de texto estourando a caixa). Não depende
 * de navegador, então roda igual no servidor e nos testes.
 */
export function estimateLines(
  text: string,
  fontSize: number,
  boxWidth: number,
  font: FontToken = 'body',
  weight = 400,
  uppercase = false,
): number {
  const avg = FONT_TOKENS[font].avgCharWidth * (weight >= 700 ? 1.06 : 1) * (uppercase ? 1.12 : 1);
  const charW = fontSize * avg;
  const maxChars = Math.max(1, Math.floor(boxWidth / charW));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const w of words) {
      const len = w.length;
      if (current === 0) {
        current = len;
        if (len > maxChars) lines += Math.floor(len / maxChars);
      } else if (current + 1 + len <= maxChars) {
        current += 1 + len;
      } else {
        lines += 1;
        current = len;
      }
    }
  }
  return lines;
}

export function estimateTextHeight(
  text: string,
  fontSize: number,
  boxWidth: number,
  font: FontToken = 'body',
  weight = 400,
  lineHeight = 1.15,
  uppercase = false,
): number {
  return estimateLines(text, fontSize, boxWidth, font, weight, uppercase) * fontSize * lineHeight;
}

/** Maior tamanho de fonte (entre min e max) que cabe na caixa. */
export function fitFontSize(
  text: string,
  box: { w: number; h: number },
  opts: { min: number; max: number; font?: FontToken; weight?: number; lineHeight?: number; uppercase?: boolean },
): number {
  const { min, max, font = 'body', weight = 400, lineHeight = 1.15, uppercase = false } = opts;
  for (let size = Math.round(max); size >= min; size -= 2) {
    if (estimateTextHeight(text, size, box.w, font, weight, lineHeight, uppercase) <= box.h) return size;
  }
  return Math.round(min);
}

export function wordsShorten(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const words = text.split(/\s+/);
  let out = '';
  for (const w of words) {
    if ((out + ' ' + w).trim().length > maxChars) break;
    out = (out + ' ' + w).trim();
  }
  return out.replace(/[,;:\-–]+$/, '') || text.slice(0, maxChars);
}
