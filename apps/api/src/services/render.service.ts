import type { CreativeDoc, RenderContext } from '@cf/shared';
import { Artboard } from '@cf/shared/render';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { env } from '../config/env';

/**
 * Exportação PNG: o MESMO componente React do editor é renderizado em HTML estático e
 * fotografado por um Chromium headless. O que o revisor viu é o que sai no arquivo.
 */
const require = createRequire(import.meta.url);

let fontCss: string | null = null;
function fontFaces(): string {
  if (fontCss) return fontCss;
  const faces: string[] = [];
  const add = (pkg: string, family: string, weights: number[]) => {
    const dir = join(dirname(require.resolve(`${pkg}/package.json`)), 'files');
    for (const w of weights) {
      const file = join(dir, `${pkg.split('/')[1]}-latin-${w}-normal.woff2`);
      if (!existsSync(file)) continue;
      const b64 = readFileSync(file).toString('base64');
      faces.push(`@font-face{font-family:'${family}';font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
    }
  };
  add('@fontsource/poppins', 'Poppins', [400, 500, 600, 700, 800]);
  add('@fontsource/inter', 'Inter', [400, 500, 600, 700]);
  fontCss = faces.join('\n');
  return fontCss;
}

export function renderHtml(doc: CreativeDoc, ctx: RenderContext): string {
  const body = renderToStaticMarkup(createElement(Artboard, { doc, ctx, scale: 1 }));
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}html,body{margin:0;padding:0;background:#fff}</style></head><body>${body}</body></html>`;
}

type Browser = import('playwright-core').Browser;
let browserPromise: Promise<Browser> | null = null;

function candidatePaths(): (string | undefined)[] {
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  return [env.chromiumPath || undefined, pw ? join(pw, 'chromium-1194/chrome-linux/chrome') : undefined, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
}

async function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright-core');
      try {
        return await chromium.launch({ args: ['--no-sandbox', '--font-render-hinting=none'] });
      } catch (first) {
        for (const p of candidatePaths()) {
          if (p && existsSync(p)) return chromium.launch({ executablePath: p, args: ['--no-sandbox', '--font-render-hinting=none'] });
        }
        throw new Error(`Chromium não encontrado para exportar PNG. Defina CHROMIUM_PATH. (${String(first).slice(0, 200)})`);
      }
    })();
    browserPromise.catch(() => (browserPromise = null));
  }
  return browserPromise;
}

export async function renderPng(doc: CreativeDoc, ctx: RenderContext): Promise<Buffer> {
  const b = await browser();
  const page = await b.newPage({ viewport: { width: doc.width, height: doc.height }, deviceScaleFactor: 1 });
  try {
    await page.setContent(renderHtml(doc, ctx), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: doc.width, height: doc.height } });
  } finally {
    await page.close();
  }
}

export async function closeRenderer() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close();
  }
}
