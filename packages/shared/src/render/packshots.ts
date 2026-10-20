import type { PackshotShape, Product } from '../domain';

/**
 * Embalagens ilustrativas geradas por código (SVG). Representam "imagem autorizada"
 * do catálogo sintético. Na integração real, Product.image passa a ser { type: 'url' }
 * apontando para o DAM/catálogo — o restante do sistema não muda.
 */
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function label(x: number, y: number, w: number, brand: string, line: string, dark: string): string {
  const inner = w - 20;
  const bs = Math.min(30, inner / (brand.length * 0.62));
  const ls = Math.min(22, inner / (line.length * 0.56));
  return `<rect x="${x}" y="${y}" width="${w}" height="120" rx="10" fill="#ffffff" opacity="0.94"/>
<text x="${x + w / 2}" y="${y + 52}" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="700" font-size="${bs.toFixed(1)}" fill="${dark}">${esc(brand)}</text>
<text x="${x + w / 2}" y="${y + 90}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="${ls.toFixed(1)}" fill="${dark}">${esc(line)}</text>`;
}

export function packshotSvg(shape: PackshotShape, color: string, brand: string, line: string): string {
  const dark = shade(color, -70);
  const light = shade(color, 40);
  let body = '';
  switch (shape) {
    case 'bottle':
      body = `<rect x="165" y="40" width="70" height="70" rx="12" fill="${dark}"/><rect x="120" y="100" width="160" height="380" rx="56" fill="${color}"/><rect x="138" y="130" width="22" height="300" rx="11" fill="${light}" opacity="0.6"/>${label(130, 230, 140, brand, line, dark)}`;
      break;
    case 'pump':
      body = `<rect x="185" y="20" width="30" height="60" fill="${dark}"/><rect x="185" y="20" width="80" height="20" rx="8" fill="${dark}"/><rect x="160" y="74" width="80" height="40" rx="10" fill="${dark}"/><rect x="115" y="108" width="170" height="372" rx="40" fill="${color}"/><rect x="132" y="135" width="22" height="300" rx="11" fill="${light}" opacity="0.6"/>${label(125, 240, 150, brand, line, dark)}`;
      break;
    case 'tube':
      body = `<path d="M120 60 L280 60 L262 420 L138 420 Z" fill="${color}"/><rect x="110" y="40" width="180" height="30" rx="6" fill="${light}"/><rect x="160" y="420" width="80" height="60" rx="10" fill="${dark}"/>${label(132, 170, 136, brand, line, dark)}`;
      break;
    case 'box':
      body = `<path d="M110 120 L270 120 L300 90 L140 90 Z" fill="${light}"/><path d="M270 120 L300 90 L300 450 L270 480 Z" fill="${dark}"/><rect x="110" y="120" width="160" height="360" fill="${color}"/>${label(118, 220, 144, brand, line, dark)}`;
      break;
    case 'jar':
      body = `<rect x="100" y="170" width="200" height="56" rx="14" fill="${dark}"/><rect x="90" y="220" width="220" height="240" rx="44" fill="${color}"/>${label(110, 270, 180, brand, line, dark)}`;
      break;
    case 'blister':
      body = `<rect x="80" y="90" width="240" height="380" rx="24" fill="${color}"/>${label(100, 110, 200, brand, line, dark)}${[0, 1, 2]
        .map((r) => [0, 1].map((c) => `<circle cx="${160 + c * 80}" cy="${290 + r * 60}" r="22" fill="#ffffff" opacity="0.85"/>`).join(''))
        .join('')}`;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><ellipse cx="200" cy="492" rx="130" ry="16" fill="#000" opacity="0.10"/>${body}</svg>`;
}

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect x="40" y="40" width="320" height="440" rx="24" fill="#f1f3f3" stroke="#9aa5a8" stroke-width="6" stroke-dasharray="18 12"/><text x="200" y="250" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="30" fill="#4F6368">SEM IMAGEM</text><text x="200" y="292" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#4F6368">AUTORIZADA</text></svg>`;

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function productImageSrc(p: Product | undefined): string {
  if (!p || p.image.type === 'none') return svgDataUri(PLACEHOLDER);
  if (p.image.type === 'url') return p.image.src;
  const short = p.name.split(' ').slice(0, 2).join(' ');
  return svgDataUri(packshotSvg(p.image.shape, p.image.color, p.brand, short));
}
