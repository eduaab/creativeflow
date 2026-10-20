import * as React from 'react';
void React;
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { BRAND_LOGO_LIGHT_SVG, BRAND_LOGO_SVG, cssFont, hex } from '../brand/brand';
import type { CreativeDoc, Layer, RenderContext } from '../domain';
import { resolveLayerText, resolvePrice } from '../format';
import { productImageSrc } from './packshots';

/**
 * Renderizador único da peça. O MESMO componente é usado no editor (navegador) e na
 * exportação PNG (servidor, via renderToStaticMarkup + Chromium headless).
 * Isso garante que o arquivo exportado é exatamente o que o revisor aprovou.
 */
export interface ArtboardProps {
  doc: CreativeDoc;
  ctx: RenderContext;
  scale?: number;
  selectedId?: string | null;
  highlightIds?: string[];
  onLayerPointerDown?: (e: ReactPointerEvent<HTMLDivElement>, layer: Layer) => void;
  onBackgroundPointerDown?: () => void;
}

export function Artboard({ doc, ctx, scale = 1, selectedId, highlightIds = [], onLayerPointerDown, onBackgroundPointerDown }: ArtboardProps) {
  const layers = [...doc.layers].filter((l) => !l.hidden).sort((a, b) => a.z - b.z);
  return (
    <div
      style={{ width: doc.width * scale, height: doc.height * scale, position: 'relative', overflow: 'hidden', flexShrink: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.artboard === 'root') onBackgroundPointerDown?.();
      }}
    >
      <div
        data-artboard="root"
        style={{
          width: doc.width,
          height: doc.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          left: 0,
          top: 0,
          background: hex(doc.background, 'white'),
          overflow: 'hidden',
        }}
      >
        {layers.map((l) => (
          <LayerView
            key={l.id}
            layer={l}
            ctx={ctx}
            selected={selectedId === l.id}
            highlighted={highlightIds.includes(l.id)}
            scale={scale}
            onPointerDown={onLayerPointerDown}
          />
        ))}
      </div>
    </div>
  );
}

function LayerView({
  layer: l,
  ctx,
  selected,
  highlighted,
  scale,
  onPointerDown,
}: {
  layer: Layer;
  ctx: RenderContext;
  selected: boolean;
  highlighted: boolean;
  scale: number;
  onPointerDown?: ArtboardProps['onLayerPointerDown'];
}) {
  const s = l.style;
  const outlineW = Math.max(2, 2 / scale);
  const base: CSSProperties = {
    position: 'absolute',
    left: l.x,
    top: l.y,
    width: l.w,
    height: l.h,
    boxSizing: 'border-box',
    opacity: s.opacity ?? 1,
    outline: selected ? `${outlineW}px solid #2563eb` : highlighted ? `${outlineW}px dashed #dc2626` : undefined,
    outlineOffset: selected || highlighted ? outlineW : undefined,
    cursor: onPointerDown ? 'move' : undefined,
    userSelect: 'none',
  };
  const handlers = onPointerDown ? { onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => onPointerDown(e, l) } : {};

  if (l.kind === 'shape') {
    return (
      <div
        {...handlers}
        data-layer-id={l.id}
        style={{
          ...base,
          background: hex(s.fill, 'primarySoft'),
          borderRadius: s.shape === 'circle' ? '50%' : (s.radius ?? 0),
        }}
      />
    );
  }

  if (l.kind === 'logo') {
    const svg = (s.fill === 'white' ? BRAND_LOGO_LIGHT_SVG : BRAND_LOGO_SVG).replace('<svg ', '<svg width="100%" height="100%" preserveAspectRatio="xMinYMid meet" ');
    return <div {...handlers} data-layer-id={l.id} style={base} dangerouslySetInnerHTML={{ __html: svg }} />;
  }

  if (l.kind === 'image') {
    const sku = l.binding?.sku;
    const src = productImageSrc(sku ? ctx.products[sku] : undefined);
    return (
      <div {...handlers} data-layer-id={l.id} style={base}>
        <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      </div>
    );
  }

  if (l.kind === 'price-tag') {
    const r = resolvePrice(l, ctx);
    const h = l.h;
    if (!r.ok) {
      return (
        <div
          {...handlers}
          data-layer-id={l.id}
          style={{
            ...base,
            background: hex('ink'),
            color: '#fff',
            borderRadius: s.radius ?? 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: cssFont('display'),
            fontWeight: 700,
            fontSize: Math.min(h * 0.2, l.w * 0.09),
            padding: h * 0.08,
          }}
        >
          PREÇO INDISPONÍVEL
        </div>
      );
    }
    const intLen = r.price!.int.length;
    const hasList = !!r.listPrice;
    const mainH = hasList ? h * 0.72 : h;
    const est = mainH * (0.22 * 0.62 * 2 + 0.56 * 0.62 * intLen + 0.3 * 0.62 * 3) + mainH * 0.2;
    const k = Math.min(1, (l.w * 0.92) / est);
    return (
      <div
        {...handlers}
        data-layer-id={l.id}
        style={{
          ...base,
          background: hex(s.bg, 'accent'),
          color: hex(s.color, 'white'),
          borderRadius: s.radius ?? 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: cssFont('display'),
          lineHeight: 1,
        }}
      >
        {hasList && (
          <div style={{ fontSize: h * 0.15 * Math.max(k, 0.8), fontWeight: 500, fontFamily: cssFont('body'), opacity: 0.95, marginBottom: h * 0.03 }}>
            De <span style={{ textDecoration: 'line-through' }}>{r.listPrice}</span> por
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', fontWeight: 800 }}>
          <span style={{ fontSize: mainH * 0.22 * k, marginTop: mainH * 0.12 * k, marginRight: mainH * 0.05 * k, fontWeight: 600 }}>R$</span>
          <span style={{ fontSize: mainH * 0.56 * k, letterSpacing: -mainH * 0.01 }}>{r.price!.int}</span>
          <span style={{ fontSize: mainH * 0.3 * k, marginTop: mainH * 0.04 * k }}>,{r.price!.dec}</span>
        </div>
      </div>
    );
  }

  // texto
  const text = resolveLayerText(l, ctx);
  const justify = s.valign === 'bottom' ? 'flex-end' : s.valign === 'middle' ? 'center' : 'flex-start';
  return (
    <div
      {...handlers}
      data-layer-id={l.id}
      style={{
        ...base,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        textAlign: s.align ?? 'left',
        fontFamily: cssFont(s.font),
        fontSize: s.fontSize ?? 24,
        fontWeight: s.fontWeight ?? 400,
        lineHeight: s.lineHeight ?? 1.15,
        letterSpacing: s.letterSpacing,
        textTransform: s.uppercase ? 'uppercase' : undefined,
        fontStyle: s.italic ? 'italic' : undefined,
        color: hex(s.color, 'ink'),
        background: s.bg ? hex(s.bg) : undefined,
        borderRadius: s.radius,
        padding: s.bg ? `0 ${Math.round(l.w * 0.07)}px` : s.padding,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </div>
  );
}
