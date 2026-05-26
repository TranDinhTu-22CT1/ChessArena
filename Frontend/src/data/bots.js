function animalAvatar(emoji, background) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <radialGradient id="glow" cx="34%" cy="24%" r="78%">
          <stop offset="0" stop-color="#fff" stop-opacity=".75"/>
          <stop offset=".45" stop-color="${background}"/>
          <stop offset="1" stop-color="#111814"/>
        </radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".28"/>
        </filter>
      </defs>
      <rect width="96" height="96" rx="18" fill="url(#glow)"/>
      <circle cx="72" cy="20" r="11" fill="#a7c957" opacity=".9"/>
      <circle cx="24" cy="74" r="14" fill="#ffffff" opacity=".18"/>
      <text x="48" y="66" text-anchor="middle" font-size="52" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" filter="url(#shadow)">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const BOT_PERSONAS = [
  { elo: 1320, avatar: animalAvatar('\u2659', '#ffd6df'), name: 'Stockfish Club', mood: 'Sức mạnh UCI_Elo 1320', chat: 'Stockfish đã sẵn sàng ở mức 1320.' },
  { elo: 1600, avatar: animalAvatar('\u2657', '#bfe7ff'), name: 'Mèo Nova', mood: 'Tinh nghịch, thích bẫy chiến thuật', chat: 'Nước đầu tiên của bạn làm tớ tỉnh ngủ rồi đó.' },
  { elo: 2000, avatar: animalAvatar('\u2656', '#dbc7ff'), name: 'Bunny Aya', mood: 'Nhanh nhẹn, tấn công sắc bén', chat: 'Aya nhảy vào trung tâm đây. Đừng để tớ nhảy luôn vào hậu nhé.' },
  { elo: 2400, avatar: animalAvatar('\u2655', '#d8ddff'), name: 'Stockfish Master', mood: 'Sức mạnh UCI_Elo 2400', chat: 'Stockfish đang tính theo chuẩn master.' },
  { elo: 2800, avatar: animalAvatar('\u2654', '#d8ddff'), name: 'Stockfish Elite', mood: 'Sức mạnh UCI_Elo 2800', chat: 'Stockfish elite không bỏ qua sai lầm chiến thuật.' },
  { elo: 3190, avatar: animalAvatar('\u265A', '#bfe7ff'), name: 'Stockfish Max', mood: 'Không giới hạn sức mạnh engine', chat: 'Stockfish đang chạy ở sức mạnh tối đa.' }
];

export const BOT_CHAT_LINES = {
  opening: [
    'Mở màn gọn gàng nhé, mình đang nhìn trung tâm rất kỹ.',
    'Ván này có mùi thú vị rồi đó, chưa biết là chiến thuật hay nguy hiểm.',
    'Để xem bạn chọn kế hoạch gì nào, mình đã chuẩn bị kính lúp rồi.',
    'Khai cuộc này ổn áp đó, tạm thời chưa có điểm yếu lớn.'
  ],
  playerMove: [
    'Nước mới rồi, để mình tính lại một chút.',
    'Bạn đổi hướng kế hoạch à? Nghe có vẻ nguy hiểm đấy.',
    'Mình thấy ý tưởng rồi, nhưng cũng thấy vài khe hở nhỏ.',
    'Nước này làm bàn cờ sống động hơn hẳn.',
    'Ổn đó, cứ giữ nhịp này là đối thủ phải nghiêm túc lên.'
  ],
  botMove: [
    'Đối thủ vừa đặt thêm một câu hỏi cho bạn.',
    'Nước này giữ áp lực khá tốt, bạn nên kiểm tra vua và quân treo.',
    'Không màu mè, nhưng khá khó chịu đó nha.',
    'Trả lời sai ở đây có thể mất nhịp hoặc mất quân.',
    'Thử xử lý thế này xem nào, bài kiểm tra nhỏ thôi.'
  ],
  brilliant: [
    'Đỉnh thật, nước đó rất sáng!',
    'Nước này đáng khen. Bạn thấy ý tưởng rất nhanh.',
    'Hay quá, đúng kiểu chiến thuật đẹp.'
  ],
  great: [
    'Nước rất mạnh, đối thủ phải dè chừng rồi.',
    'Bạn vừa tìm được một nước đáng gờm.',
    'Tốt lắm, nước này tạo áp lực rõ ràng.'
  ],
  best: [
    'Chuẩn bài. Nước này rất sạch.',
    'Chính xác, bạn chọn đúng hướng rồi.',
    'Không có gì để chê, nước này hay.'
  ],
  excellent: [
    'Rất ổn, bạn đang giữ thế cờ chắc.',
    'Nước này đẹp và thực dụng, không cần màu mè vẫn hiệu quả.',
    'Mình thích cách bạn cải thiện quân.'
  ],
  good: [
    'Nước ổn, thế trận vẫn dễ chơi.',
    'Không tệ, bạn vẫn giữ được nhịp.',
    'Nước bình tĩnh, chưa có lỗi lớn.'
  ],
  inaccuracy: [
    'Hơi lệch một chút, nhưng chưa rơi xuống vực đâu.',
    'Nước này chưa tối ưu, nhưng vẫn còn đường sửa sai.',
    'Bạn vừa để rơi chút lợi thế, nhặt lại nhanh còn kịp.'
  ],
  mistake: [
    'Cẩn thận, nước đó cho đối thủ cơ hội rồi.',
    'Mình bắt đầu thấy mùi chiến thuật ở đây.',
    'Nước này hơi mạo hiểm, cần giảm thiệt hại ngay.'
  ],
  miss: [
    'Bạn vừa bỏ lỡ một cơ hội khá ngon đó.',
    'Có một nước sắc hơn ở đây, tiếc ghê.',
    'Đối thủ vừa thoát được một phen.'
  ],
  blunder: [
    'Ôi không, nước này đau đấy, nhưng đừng bỏ cuộc.',
    'Cơ hội lớn cho đối thủ rồi, giờ bình tĩnh nào.',
    'Nước này nguy hiểm thật, tìm cách giảm thiệt hại ngay.'
  ]
};
