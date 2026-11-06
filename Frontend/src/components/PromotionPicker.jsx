import React from 'react';
import { getPieceImage } from '../game/pieces';

const names = { q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' };

export default function PromotionPicker({ request, pieceSet, flipped = false, onChoose, onClose }) {
  const ref = React.useRef(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    if (!request) return undefined;
    const previous = document.activeElement;
    ref.current?.querySelector('[data-promotion]')?.focus();
    const outside = (event) => { if (!ref.current?.contains(event.target)) closeRef.current?.(); };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); if (previous?.isConnected) previous.focus(); };
  }, [request]);
  if (!request) return null;
  const row = flipped ? Number(request.to[1]) - 1 : 8 - Number(request.to[1]);
  return <div ref={ref} className="promotion-board-popover" role="dialog" aria-label="Chọn quân phong cấp"
    style={{ left: '50%', ...(row < 4 ? { top: '13%' } : { bottom: '13%' }) }}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...ref.current.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
    }}>
    <button type="button" className="promotion-close" aria-label="Hủy phong cấp" onClick={onClose}>×</button>
    {Object.entries(names).map(([piece, name]) => <button type="button" data-promotion key={piece}
      aria-label={`Phong cấp thành ${name}`} onClick={() => onChoose(piece)}>
      <img className={`piece-set-${pieceSet}`} src={getPieceImage(pieceSet, `${request.color}${piece}`)} alt={name} draggable="false" />
    </button>)}
  </div>;
}
