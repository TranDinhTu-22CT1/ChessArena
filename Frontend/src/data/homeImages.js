function chessBoardImage(type) {
  const setups = {
    hero: { dark: '#789a5f', light: '#f0ead2', accent: '#a7c957', pieces: { 4: '\u265a', 11: '\u265b', 18: '\u265e', 28: '\u2659', 35: '\u2657', 44: '\u2656', 52: '\u2654', 59: '\u2655' } },
    puzzle: { dark: '#6c8058', light: '#e9dfc2', accent: '#ffcf5b', pieces: { 2: '\u265c', 10: '\u265f', 20: '\u2654', 27: '\u265b', 36: '\u2658', 43: '\u2659', 54: '\u2656', 61: '\u265a' } },
    lesson: { dark: '#607a66', light: '#e7eadb', accent: '#79d2ff', pieces: { 3: '\u265b', 12: '\u265e', 25: '\u2659', 34: '\u2657', 42: '\u2658', 51: '\u2654', 60: '\u265c' } },
    review: { dark: '#876447', light: '#d7b98c', accent: '#8ee28f', pieces: { 6: '\u265a', 14: '\u265f', 23: '\u2655', 30: '\u2656', 37: '\u2658', 45: '\u2659', 54: '\u2654' } }
  };
  const config = setups[type] ?? setups.hero;
  const squares = Array.from({ length: 64 }).map((_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const fill = (row + col) % 2 === 0 ? config.light : config.dark;
    const piece = config.pieces[index];
    return `
      <rect x="${col * 80}" y="${row * 80}" width="80" height="80" fill="${fill}" />
      ${piece ? `<text x="${col * 80 + 40}" y="${row * 80 + 55}" text-anchor="middle" font-size="54" font-family="Segoe UI" fill="${piece.charCodeAt(0) > 9817 ? '#151711' : '#f8f6ea'}" filter="url(#shadow)">${piece}</text>` : ''}
    `;
  }).join('');
  const marks = type === 'hero'
    ? '<rect x="320" y="320" width="80" height="80" fill="#a7c957" opacity=".34"/><path d="M360 570 L360 360" stroke="#a7c957" stroke-width="26" stroke-linecap="round" opacity=".78" marker-end="url(#arrow)"/>'
    : type === 'review'
      ? '<circle cx="280" cy="360" r="26" fill="#8ee28f" opacity=".86"/><path d="280 520 L360 360" stroke="#8ee28f" stroke-width="20" stroke-linecap="round" opacity=".75" marker-end="url(#arrow)"/>'
      : '<circle cx="360" cy="280" r="25" fill="#ffcf5b" opacity=".78"/><circle cx="440" cy="360" r="25" fill="#ffcf5b" opacity=".46"/>';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="3" flood-color="#000" flood-opacity=".32"/>
        </filter>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="${config.accent}"/>
        </marker>
      </defs>
      <rect width="640" height="640" fill="#121711"/>
      ${squares}
      ${marks}
      <rect x="0" y="0" width="640" height="640" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="18"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const HOME_IMAGES = {
  hero: chessBoardImage('hero'),
  puzzle: chessBoardImage('puzzle'),
  lesson: chessBoardImage('lesson'),
  review: chessBoardImage('review')
};
