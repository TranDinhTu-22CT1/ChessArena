import React from 'react';

export default function ConfigSection({ config }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Cau hinh he thong</span>
          <h2>Cau hinh runtime</h2>
        </div>
      </div>
      <div className="admin-config-grid">
        {Object.entries(config || {}).map(([key, value]) => (
          <div key={key}>
            <strong>{key}</strong>
            <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
