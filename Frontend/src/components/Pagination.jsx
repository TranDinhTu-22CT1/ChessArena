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
  if (!Number.isFinite(totalPages) || totalPages <= 1) return null;
  const safePage = Math.max(1, Math.min(totalPages, page));
  const go = (nextPage) => onPageChange(Math.max(1, Math.min(totalPages, nextPage)));

  return (
    <nav className="pagination" aria-label={label}>
      <button disabled={safePage === 1} onClick={() => go(1)} type="button" aria-label="Trang đầu">
        <ChevronsLeft size={16} />
      </button>
      <button disabled={safePage === 1} onClick={() => go(safePage - 1)} type="button" aria-label="Trang trước">
        <ChevronLeft size={16} />
      </button>
      {pageItems(safePage, totalPages).map((item) => (
        typeof item === 'number' ? (
          <button className={item === safePage ? 'active' : ''} key={item} onClick={() => go(item)} type="button">
            {item}
          </button>
        ) : (
          <span key={item}>...</span>
        )
      ))}
      <button disabled={safePage === totalPages} onClick={() => go(safePage + 1)} type="button" aria-label="Trang sau">
        <ChevronRight size={16} />
      </button>
      <button disabled={safePage === totalPages} onClick={() => go(totalPages)} type="button" aria-label="Trang cuối">
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}
