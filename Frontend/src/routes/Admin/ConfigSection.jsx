import React from 'react';
import { LoadingBlock } from '../../components/LoadingSpinner';

export default function ConfigSection({
  admin,
  config,
  testAdmin,
  loading = false,
  onGrantTestAdmin,
  onRevokeTestAdmin
}) {
  const canManageTestAdmin = !admin?.isTestAdmin;
  const expiresLabel = testAdmin?.expiresAt
    ? new Date(testAdmin.expiresAt).toLocaleString('vi-VN')
    : '';

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Cấu hình hệ thống</span>
          <h2>Cấu hình runtime</h2>
        </div>
      </div>
      <div className="admin-config-grid">
        {loading && <LoadingBlock label="Đang tải cấu hình hệ thống" />}
        {Object.entries(config || {}).map(([key, value]) => (
          <div key={key}>
            <strong>{key}</strong>
            <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
          </div>
        ))}
      </div>
      <div className="admin-panel-head">
        <div>
          <span>Admin test</span>
          <h2>{testAdmin?.email || 'admintest@gmail.com'}</h2>
          <p>
            Trang thai: {testAdmin?.granted ? 'da duoc cap quyen' : 'dang khoa'}
            {testAdmin?.enabled ? '' : ' | test accounts dang tat'}
            {testAdmin?.granted && expiresLabel ? ` | het han: ${expiresLabel}` : ''}
          </p>
        </div>
        {canManageTestAdmin && (
          <div className="admin-actions">
            <button type="button" onClick={onGrantTestAdmin} disabled={!testAdmin?.enabled || testAdmin?.granted}>
              Cap quyen 24h
            </button>
            <button type="button" onClick={onRevokeTestAdmin} disabled={!testAdmin?.enabled || !testAdmin?.granted}>
              Thu hoi
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
