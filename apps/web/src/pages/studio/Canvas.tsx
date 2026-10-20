import type { CreativeDoc, Layer, RenderContext } from '@cf/shared';
import { Artboard } from '@cf/shared/render';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

/**
 * Canvas de edição direta: selecionar, arrastar e redimensionar camadas.
 * Cada gesto vira operações estruturadas (patch) — nunca uma imagem nova.
 */
export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se';

export function Canvas({
  doc,
  ctx,
  selectedId,
  onSelect,
  onCommit,
  highlightIds,
  readOnly,
  safeArea,
  showSafe,
}: {
  doc: CreativeDoc;
  ctx: RenderContext;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (layerId: string, from: Geometry, to: Geometry) => void;
  highlightIds: string[];
  readOnly?: boolean;
  safeArea: { top: number; right: number; bottom: number; left: number };
  showSafe: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 700, h: 700 });
  const [live, setLive] = useState<{ id: string; g: Geometry } | null>(null);
  const drag = useRef<{ id: string; mode: 'move' | Handle; sx: number; sy: number; g: Geometry } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 48, h: el.clientHeight - 48 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.max(0.05, Math.min(box.w / doc.width, box.h / doc.height));
  const shown: CreativeDoc = live ? { ...doc, layers: doc.layers.map((l) => (l.id === live.id ? { ...l, ...live.g } : l)) } : doc;
  const selected = shown.layers.find((l) => l.id === selectedId && !l.hidden);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / scale;
      const dy = (e.clientY - d.sy) / scale;
      const g = { ...d.g };
      if (d.mode === 'move') {
        g.x = d.g.x + dx;
        g.y = d.g.y + dy;
      } else {
        if (d.mode.includes('e')) g.w = Math.max(20, d.g.w + dx);
        if (d.mode.includes('s')) g.h = Math.max(20, d.g.h + dy);
        if (d.mode.includes('w')) {
          g.w = Math.max(20, d.g.w - dx);
          g.x = d.g.x + (d.g.w - g.w);
        }
        if (d.mode.includes('n')) {
          g.h = Math.max(20, d.g.h - dy);
          g.y = d.g.y + (d.g.h - g.h);
        }
        if (e.shiftKey) {
          const ratio = d.g.w / d.g.h;
          g.h = g.w / ratio;
        }
      }
      setLive({ id: d.id, g: { x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.w), h: Math.round(g.h) } });
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      setLive((cur) => {
        if (d && cur && (cur.g.x !== d.g.x || cur.g.y !== d.g.y || cur.g.w !== d.g.w || cur.g.h !== d.g.h)) onCommit(d.id, d.g, cur.g);
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [scale, onCommit]);

  const start = (e: RPointerEvent, layer: Layer, mode: 'move' | Handle) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(layer.id);
    if (readOnly) return;
    drag.current = { id: layer.id, mode, sx: e.clientX, sy: e.clientY, g: { x: layer.x, y: layer.y, w: layer.w, h: layer.h } };
  };

  return (
    <div ref={wrap} className="checker relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-200" onPointerDown={() => onSelect(null)}>
      <div className="relative shadow-xl" style={{ width: doc.width * scale, height: doc.height * scale }} onPointerDown={(e) => e.stopPropagation()}>
        <Artboard doc={shown} ctx={ctx} scale={scale} selectedId={null} highlightIds={highlightIds} onLayerPointerDown={(e, l) => start(e, l, 'move')} onBackgroundPointerDown={() => onSelect(null)} />
        {showSafe && (
          <div
            className="pointer-events-none absolute border border-dashed border-sky-500/70"
            style={{ left: safeArea.left * scale, top: safeArea.top * scale, right: safeArea.right * scale, bottom: safeArea.bottom * scale }}
          />
        )}
        {selected && (
          <div
            className="pointer-events-none absolute border-2 border-blue-600"
            style={{ left: selected.x * scale - 1, top: selected.y * scale - 1, width: selected.w * scale + 2, height: selected.h * scale + 2 }}
          >
            {!readOnly &&
              (['nw', 'ne', 'sw', 'se'] as Handle[]).map((h) => (
                <div
                  key={h}
                  onPointerDown={(e) => start(e, selected, h)}
                  className="pointer-events-auto absolute h-3 w-3 rounded-sm border-2 border-blue-600 bg-white"
                  style={{
                    left: h.includes('w') ? -7 : undefined,
                    right: h.includes('e') ? -7 : undefined,
                    top: h.includes('n') ? -7 : undefined,
                    bottom: h.includes('s') ? -7 : undefined,
                    cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                />
              ))}
            <div className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {selected.id} · {selected.w}×{selected.h}
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-[11px] text-slate-600 shadow">
        {doc.width}×{doc.height}px · {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
