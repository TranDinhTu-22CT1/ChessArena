import React from 'react';
import { Home, SearchX } from 'lucide-react';

export default function NotFoundPage({ onNavigate }) {
  return (
    <section className="not-found-page">
      <div className="not-found-board" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, index) => <span key={index} />)}
      </div>
      <div className="not-found-card">
        <SearchX size={46} />
        <span>404</span>
        <h1>Trang này không tồn tại</h1>
        <p>Nước đi này nằm ngoài bàn cờ. Quay lại trang chủ để tiếp tục chơi hoặc luyện tập.</p>
        <button onClick={() => onNavigate('home')}><Home size={18} /> Về trang chủ</button>
      </div>
    </section>
  );
}
