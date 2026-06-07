import React from 'react';

export default function LoadingSpinner({ label = 'Đang tải', size = 'md', inline = false }) {
  return (
    <span className={`loading-spinner-wrap ${inline ? 'inline' : ''}`} role="status" aria-live="polite">
      <span className={`loading-spinner ${size}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = 'Đang tải dữ liệu' }) {
  return (
    <div className="standard-loading-block" role="status" aria-live="polite">
      <LoadingSpinner label={label} size="lg" />
    </div>
  );
}
