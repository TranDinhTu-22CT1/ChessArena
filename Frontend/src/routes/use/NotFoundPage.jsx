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
        <h1>Trang nĂ y khĂ´ng tá»“n táº¡i</h1>
        <p>NÆ°á»›c Ä‘i nĂ y náº±m ngoĂ i bĂ n cá». Quay láº¡i trang chá»§ Ä‘á»ƒ tiáº¿p tá»¥c chÆ¡i hoáº·c luyá»‡n táº­p.</p>
        <button onClick={() => onNavigate('home')}><Home size={18} /> Vá» trang chá»§</button>
      </div>
    </section>
  );
}
