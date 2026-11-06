export const REVIEW_LEGEND = [
  { tone: 'brilliant', icon: '!!', label: 'Thiên tài', detail: 'Thí quân giữ được thế cờ, đã kiểm tra biến bắt quân bằng Stockfish' },
  { tone: 'great', icon: '!', label: 'Rất mạnh', detail: 'Nước rất mạnh' },
  { tone: 'book', icon: 'B', label: 'Theo lý thuyết', detail: 'Nước khai cuộc lý thuyết' },
  { tone: 'best', icon: '*', label: 'Tốt nhất', detail: 'Nước tốt nhất hoặc gần như tốt nhất' },
  { tone: 'excellent', icon: '++', label: 'Rất tốt', detail: 'Rất mạnh, mất rất ít lợi thế' },
  { tone: 'good', icon: '+', label: 'Tốt', detail: 'Chơi ổn, vẫn giữ thế trận' },
  { tone: 'inaccuracy', icon: '?!', label: 'Chưa chính xác', detail: 'Chưa chính xác, mất một phần lợi thế' },
  { tone: 'mistake', icon: '?', label: 'Sai lầm', detail: 'Sai lầm rõ ràng' },
  { tone: 'miss', icon: 'X', label: 'Bỏ lỡ', detail: 'Bỏ lỡ cơ hội lớn' },
  { tone: 'blunder', icon: '??', label: 'Sai lầm nghiêm trọng', detail: 'Nước đi làm hỏng thế trận nghiêm trọng' }
];

const REVIEW_ICON_BY_TONE = {
  brilliant: '!!',
  great: '!',
  book: 'B',
  best: '*',
  excellent: '++',
  good: '+',
  inaccuracy: '?!',
  mistake: '?',
  miss: 'X',
  blunder: '??',
  unavailable: '—',
  loading: '...'
};

export function reviewIcon(tone) {
  return REVIEW_ICON_BY_TONE[tone] ?? '?';
}

export function reviewLabel(tone) {
  return REVIEW_LEGEND.find((item) => item.tone === tone)?.label || (tone === 'loading' ? 'Đang phân tích' : tone === 'unavailable' ? 'Không thể phân tích' : 'Chưa có đánh giá');
}
