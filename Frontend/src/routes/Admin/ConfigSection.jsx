import React from 'react';

export default function ConfigSection({ config }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Cấu hình hệ thống</span>
          <h2>Cấu hình runtime</h2>
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
