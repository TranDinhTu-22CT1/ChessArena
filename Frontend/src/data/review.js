export const REVIEW_LEGEND = [
  { tone: 'brilliant', icon: '!!', label: 'Brilliant', detail: 'Nước xuất sắc hiếm gặp' },
  { tone: 'great', icon: '!', label: 'Great', detail: 'Nước rất mạnh' },
  { tone: 'book', icon: 'B', label: 'Book', detail: 'Nước khai cuộc lý thuyết' },
  { tone: 'best', icon: '*', label: 'Best', detail: 'Nước tốt nhất hoặc gần như tốt nhất' },
  { tone: 'excellent', icon: '^', label: 'Excellent', detail: 'Rất mạnh, mất rất ít lợi thế' },
  { tone: 'good', icon: 'OK', label: 'Good', detail: 'Chơi ổn, vẫn giữ thế trận' },
  { tone: 'inaccuracy', icon: '?!', label: 'Inaccuracy', detail: 'Chưa chính xác, mất một phần lợi thế' },
  { tone: 'mistake', icon: '?', label: 'Mistake', detail: 'Sai lầm rõ ràng' },
  { tone: 'miss', icon: 'x', label: 'Miss', detail: 'Bỏ lỡ cơ hội lớn' },
  { tone: 'blunder', icon: '??', label: 'Blunder', detail: 'Nước đi làm hỏng thế trận nghiêm trọng' }
];

const REVIEW_ICON_BY_TONE = {
  brilliant: '!!',
  great: '!',
  book: 'B',
  best: '*',
  excellent: '^',
  good: 'OK',
  inaccuracy: '?!',
  mistake: '?',
  miss: 'x',
  blunder: '??',
  loading: '...'
};

export function reviewIcon(tone) {
  return REVIEW_ICON_BY_TONE[tone] ?? '?';
}
