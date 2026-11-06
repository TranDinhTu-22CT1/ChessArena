import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export default function AdminFilterBar({ value, onApply, selects = [], searchPlaceholder = 'Tìm kiếm…' }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value]);
  const update = (key, nextValue) => setDraft((current) => ({ ...current, [key]: nextValue }));
  const clear = () => {
    const empty = Object.fromEntries(Object.keys(value).map((key) => [key, '']));
    setDraft(empty);
    onApply(empty);
  };
  return (
    <form className="admin-filter-bar" onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
      <label className="admin-filter-search"><Search size={17} /><input value={draft.search || ''} onChange={(event) => update('search', event.target.value)} placeholder={searchPlaceholder} /><button type="button" disabled={!draft.search} onClick={() => update('search', '')} aria-label="Xóa tìm kiếm"><X size={15} /></button></label>
      {selects.map((select) => (
        <label key={select.key}><span>{select.label}</span><select value={draft[select.key] || ''} onChange={(event) => update(select.key, event.target.value)}>{select.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      ))}
      <label><span>Từ ngày</span><input type="date" value={draft.dateFrom || ''} max={draft.dateTo || undefined} onChange={(event) => update('dateFrom', event.target.value)} /></label>
      <label><span>Đến ngày</span><input type="date" value={draft.dateTo || ''} min={draft.dateFrom || undefined} onChange={(event) => update('dateTo', event.target.value)} /></label>
      <div><button type="submit"><SlidersHorizontal size={16} /> Áp dụng</button><button type="button" onClick={clear}>Đặt lại</button></div>
    </form>
  );
}
