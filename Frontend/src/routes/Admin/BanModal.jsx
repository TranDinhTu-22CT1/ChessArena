import React from 'react';
import { Ban } from 'lucide-react';

export default function BanModal({
  banTarget,
  banForm,
  onSubmit,
  onClose,
  onChange
}) {
  if (!banTarget) return null;
  return (
    <div className="admin-modal-layer" role="dialog" aria-modal="true">
      <form className="admin-modal admin-ban-form" onSubmit={onSubmit}>
        <div className="admin-panel-head">
          <div>
            <span>{banForm.banType === 'risk' ? 'Risk ban' : 'Cam tai khoan'}</span>
            <h2>{banTarget.display_name || banTarget.email}</h2>
          </div>
          <button type="button" onClick={onClose}>Dong</button>
        </div>
        <label>Kieu cam
          <select value={banForm.banType} onChange={(event) => onChange({ banType: event.target.value })}>
            <option value="account">Chi cam tai khoan</option>
            <option value="account_device">Tai khoan + thiet bi</option>
            <option value="device">Chi thiet bi</option>
            <option value="risk">Risk ban: tai khoan + thiet bi + IP prefix + trinh duyet</option>
          </select>
        </label>
        {banForm.banType === 'risk' && (
          <p className="admin-ban-note">
            Risk ban cho web se chan tai khoan, fingerprint trinh duyet hien tai, IP prefix va user-agent signature cung luc.
          </p>
        )}
        <label>Ly do
          <textarea value={banForm.reason} onChange={(event) => onChange({ reason: event.target.value })} />
        </label>
        <label>Het han luc (khong bat buoc)
          <input type="datetime-local" value={banForm.expiresAt} onChange={(event) => onChange({ expiresAt: event.target.value })} />
        </label>
        <button><Ban size={16} /> Xac nhan cam</button>
      </form>
    </div>
  );
}
