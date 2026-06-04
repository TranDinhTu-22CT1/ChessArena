import React from 'react';
import { BookOpen, CheckCircle2, Crown, Flag, Shield, Sparkles, Target } from 'lucide-react';

const PIECES = [
  { piece: '♔', name: 'Vua', move: 'Đi 1 ô theo mọi hướng.', note: 'Phải luôn được bảo vệ. Nếu vua bị chiếu hết thì thua.' },
  { piece: '♕', name: 'Hậu', move: 'Đi ngang, dọc, chéo tùy số ô.', note: 'Quân mạnh nhất, thường dùng để tấn công và phối hợp chiếu hết.' },
  { piece: '♖', name: 'Xe', move: 'Đi ngang hoặc dọc tùy số ô.', note: 'Mạnh ở cột mở, hàng ngang và cuối ván.' },
  { piece: '♗', name: 'Tượng', move: 'Đi chéo tùy số ô.', note: 'Tượng chỉ ở cùng màu ô từ đầu đến cuối ván.' },
  { piece: '♘', name: 'Mã', move: 'Đi hình chữ L: 2 ô một hướng rồi 1 ô vuông góc.', note: 'Có thể nhảy qua quân khác.' },
  { piece: '♙', name: 'Tốt', move: 'Đi thẳng 1 ô, nước đầu có thể đi 2 ô; ăn chéo 1 ô.', note: 'Tốt tới hàng cuối sẽ được phong cấp thành hậu/xe/tượng/mã.' }
];

const MOVE_RULES = [
  'Mỗi lượt chỉ đi một quân, trừ nhập thành.',
  'Không được đi nước khiến vua của mình bị chiếu.',
  'Ăn quân bằng cách đi tới ô quân đối phương đang đứng, riêng tốt ăn chéo.',
  'Chiếu là khi vua bị tấn công; người bị chiếu phải hóa giải ngay.',
  'Chiếu hết là khi vua bị chiếu và không còn nước hợp lệ để thoát.',
  'Hòa có thể xảy ra khi hết nước hợp lệ nhưng không bị chiếu, lặp lại thế cờ, hoặc thiếu lực chiếu hết.'
];

const FIRST_GAME_STEPS = [
  'Đưa tốt trung tâm lên để mở đường cho quân.',
  'Phát triển mã và tượng ra khỏi hàng cuối.',
  'Nhập thành sớm để vua an toàn.',
  'Không đưa hậu ra quá sớm nếu chưa có kế hoạch rõ.',
  'Trước khi đi, tự hỏi: quân của mình có đang bị ăn không và nước này có tạo đe dọa không.'
];

function MiniBoard({ type }) {
  const marks = {
    king: [3, 4, 5, 11, 13, 19, 20, 21],
    queen: [3, 11, 19, 24, 25, 26, 27, 28, 29, 30, 31, 35, 43, 51, 59],
    knight: [9, 11, 18, 22, 34, 38, 45, 47],
    pawn: [20, 27, 29]
  }[type] || [];

  return (
    <div className="guide-mini-board" aria-hidden="true">
      {Array.from({ length: 64 }).map((_, index) => (
        <span className={marks.includes(index) ? 'marked' : ''} key={index}>
          {index === 28 ? '♙' : ''}
        </span>
      ))}
    </div>
  );
}

export default function BeginnerGuidePage({ onNavigate }) {
  return (
    <section className="beginner-guide-page">
      <header className="beginner-guide-hero">
        <div>
          <span><BookOpen size={18} /> Hướng dẫn người mới</span>
          <h1>Học cách đi quân trước khi vào ván</h1>
          <p>Nắm luật cơ bản, cách từng quân di chuyển và các bước khai cuộc đơn giản để chơi ván đầu tiên tự tin hơn.</p>
        </div>
        <button onClick={() => onNavigate?.('bot')}><Sparkles size={18} /> Luyện với bot</button>
      </header>

      <section className="guide-section">
        <div className="guide-section-title">
          <Crown size={22} />
          <h2>Từng quân đi như thế nào</h2>
        </div>
        <div className="guide-piece-grid">
          {PIECES.map((item) => (
            <article className="guide-piece-card" key={item.name}>
              <b>{item.piece}</b>
              <div>
                <h3>{item.name}</h3>
                <strong>{item.move}</strong>
                <p>{item.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section guide-board-patterns">
        <div className="guide-section-title">
          <Target size={22} />
          <h2>Nhìn mẫu nước đi</h2>
        </div>
        <div className="guide-board-grid">
          <article><MiniBoard type="king" /><strong>Vua</strong><span>Đi quanh 8 ô liền kề nếu ô đó an toàn.</span></article>
          <article><MiniBoard type="queen" /><strong>Hậu</strong><span>Kết hợp sức mạnh của xe và tượng.</span></article>
          <article><MiniBoard type="knight" /><strong>Mã</strong><span>Nhảy chữ L, rất mạnh khi đứng gần trung tâm.</span></article>
          <article><MiniBoard type="pawn" /><strong>Tốt</strong><span>Đi thẳng, ăn chéo, có thể đi 2 ô ở nước đầu.</span></article>
        </div>
      </section>

      <section className="guide-two-column">
        <div className="guide-section">
          <div className="guide-section-title">
            <Shield size={22} />
            <h2>Luật cần nhớ</h2>
          </div>
          <ul className="guide-check-list">
            {MOVE_RULES.map((rule) => <li key={rule}><CheckCircle2 size={17} /> {rule}</li>)}
          </ul>
        </div>

        <div className="guide-section">
          <div className="guide-section-title">
            <Flag size={22} />
            <h2>Checklist ván đầu</h2>
          </div>
          <ol className="guide-number-list">
            {FIRST_GAME_STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </section>
    </section>
  );
}
