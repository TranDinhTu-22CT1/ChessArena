import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('left-gap');
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < totalPages - 1) items.push('right-gap');
  items.push(totalPages);
  return items;
}

export function getUrlPage(param = 'page', fallback = 1) {
  if (typeof window === 'undefined') return fallback;
  const value = Number(new URLSearchParams(window.location.search).get(param));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function setUrlPage(page, param = 'page') {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (page <= 1) url.searchParams.delete(param);
  else url.searchParams.set(param, String(page));
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function Pagination({ page, totalPages, onPageChange, label = 'Phân trang' }) {
  const safeTotalPages = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
  const safePage = Math.max(1, Math.min(safeTotalPages, Number.isFinite(page) ? Math.floor(page) : 1));
  const go = (nextPage) => onPageChange(Math.max(1, Math.min(safeTotalPages, nextPage)));
  const [jumpPage, setJumpPage] = React.useState(String(safePage));

  React.useEffect(() => {
    setJumpPage(String(safePage));
  }, [safePage]);

  const submitJump = (event) => {
    event.preventDefault();
    const nextPage = Number(jumpPage);
    if (Number.isFinite(nextPage)) go(Math.floor(nextPage));
  };

  if (safeTotalPages <= 1) {
    return (
      <nav className="pagination pagination-single" aria-label={label}>
        <span>Trang {safePage} / {safeTotalPages}</span>
      </nav>
    );
  }

  return (
    <nav className="pagination" aria-label={label}>
      <button className="pagination-edge" disabled={safePage === 1} onClick={() => go(1)} type="button" aria-label="Trang đầu">
        <ChevronsLeft size={16} />
      </button>
      <button disabled={safePage === 1} onClick={() => go(safePage - 1)} type="button" aria-label="Trang trước">
        <ChevronLeft size={16} />
      </button>
      {pageItems(safePage, safeTotalPages).map((item) => (
        typeof item === 'number' ? (
          <button className={`pagination-number ${item === safePage ? 'active' : ''}`} aria-label={`Trang ${item}`} aria-current={item === safePage ? 'page' : undefined} key={item} onClick={() => go(item)} type="button">
            {item}
          </button>
        ) : (
          <span className="pagination-gap" key={item}>…</span>
        )
      ))}
      <button disabled={safePage === safeTotalPages} onClick={() => go(safePage + 1)} type="button" aria-label="Trang sau">
        <ChevronRight size={16} />
      </button>
      <button className="pagination-edge" disabled={safePage === safeTotalPages} onClick={() => go(safeTotalPages)} type="button" aria-label="Trang cuối">
        <ChevronsRight size={16} />
      </button>
      <span className="pagination-summary">Trang {safePage} / {safeTotalPages}</span>
      <form className="pagination-jump" onSubmit={submitJump}>
        <span>Đến trang</span>
        <input
          aria-label="Đến trang"
          min="1"
          max={safeTotalPages}
          type="number"
          value={jumpPage}
          onChange={(event) => setJumpPage(event.target.value)}
        />
        <button type="submit">Đi</button>
      </form>
    </nav>
  );
}
