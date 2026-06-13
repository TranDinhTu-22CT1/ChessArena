import React from 'react';
import BrandMark from './BrandMark';

function StateIcon({ name, size = 20 }) {
  const paths = {
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    error: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7L20 8" /><path d="M20 3v5h-5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /><path d="m8.5 8.5 5 5" /><path d="m13.5 8.5-5 5" /></>,
    wifi: <><path d="m2 8.8 2.9-2.3A11.7 11.7 0 0 1 18 6" /><path d="m5 12.5 2.3-1.8a7.5 7.5 0 0 1 6.7-.9" /><path d="M8.8 16.2a4 4 0 0 1 4.6-.5" /><path d="M12 20h.01" /><path d="m3 3 18 18" /></>
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.error}
    </svg>
  );
}

export default function SystemStatePage({
  variant = 'error',
  eyebrow,
  code,
  title,
  description,
  icon = 'error',
  primaryLabel = 'Thử lại',
  onPrimary,
  secondaryLabel,
  onSecondary,
  overlay = false
}) {
  return (
    <section
      className={`system-state system-state-${variant} ${overlay ? 'system-state-overlay' : ''}`}
      role={overlay ? 'alert' : undefined}
      aria-live={overlay ? 'assertive' : undefined}
    >
      <div className="system-state-backdrop" aria-hidden="true" />
      <div className="system-state-shell">
        <div className="system-state-visual">
          <div className="system-state-brand-scene" aria-hidden="true">
            <div className="system-state-arena-ring outer" />
            <div className="system-state-arena-ring inner" />
            <div className="system-state-board-grid">
              {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
            </div>
            <div className="system-state-brand-core">
              <BrandMark />
              <span>CA</span>
            </div>
            <i className="system-state-orbit-dot dot-one" />
            <i className="system-state-orbit-dot dot-two" />
            <i className="system-state-orbit-dot dot-three" />
          </div>
          <div className="system-state-symbol">
            <StateIcon name={icon} size={28} />
          </div>
        </div>

        <div className="system-state-content">
          <span className="system-state-eyebrow">{eyebrow}</span>
          {code && <strong className="system-state-code">{code}</strong>}
          <h1>{title}</h1>
          <p>{description}</p>

          <div className="system-state-actions">
            {onPrimary && (
              <button className="primary" type="button" onClick={onPrimary}>
                <StateIcon name={variant === 'not-found' ? 'home' : 'refresh'} size={18} />
                {primaryLabel}
              </button>
            )}
            {onSecondary && (
              <button type="button" onClick={onSecondary}>
                <StateIcon name="back" size={18} />
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
