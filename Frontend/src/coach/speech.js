const PIECES = { K: 'vua', Q: 'hậu', R: 'xe', B: 'tượng', N: 'mã' };
const FILES = { a: 'a', b: 'bê', c: 'xê', d: 'dê', e: 'e', f: 'ép', g: 'gờ', h: 'hát' };

export function vietnameseChessSpeech(text) {
  return String(text || '')
    .replace(/\bO-O-O\b/g, 'nhập thành dài')
    .replace(/\bO-O\b/g, 'nhập thành ngắn')
    .replace(/\b([KQRBN]?)([a-h1-8]?)(x?)([a-h][1-8])(=[QRBN])?([+#])?/g, (_, piece, origin, capture, square, promotion, check) => {
      const destination = `${FILES[square[0]]} ${square[1]}`;
      return `${PIECES[piece] || 'tốt'} ${origin ? `${FILES[origin] || origin} ` : ''}${capture ? 'ăn tại' : 'đến'} ${destination}${promotion ? ` phong ${PIECES[promotion[1]]}` : ''}${check === '#' ? ', chiếu hết' : check ? ', chiếu' : ''}`;
    })
    .replace(/\s+/g, ' ').trim();
}

export function vietnameseVoice(voices) {
  return voices.find((voice) => /^vi(?:[-_]|$)/i.test(voice.lang || '')) || null;
}
