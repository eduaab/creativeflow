import type { CreativeDoc, RenderContext } from '@cf/shared';
import { Artboard } from '@cf/shared/render';
import { memo } from 'react';

/** Renderiza a peça (mesmo componente da exportação) escalada para caber na caixa. */
export const Thumb = memo(function Thumb({ doc, ctx, maxW, maxH, highlightIds, className }: { doc: CreativeDoc; ctx: RenderContext; maxW: number; maxH: number; highlightIds?: string[]; className?: string }) {
  const scale = Math.min(maxW / doc.width, maxH / doc.height);
  return (
    <div className={className} style={{ width: doc.width * scale, height: doc.height * scale }}>
      <div className="overflow-hidden rounded-md shadow-sm ring-1 ring-slate-200" style={{ width: doc.width * scale, height: doc.height * scale }}>
        <Artboard doc={doc} ctx={ctx} scale={scale} highlightIds={highlightIds} />
      </div>
    </div>
  );
});
