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
            <span>{banForm.banType === 'risk' ? 'Cấm theo rủi ro' : 'Cấm tài khoản'}</span>
            <h2>{banTarget.display_name || banTarget.email}</h2>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </div>
        <label>Kiểu cấm
          <select value={banForm.banType} onChange={(event) => onChange({ banType: event.target.value })}>
            <option value="account">Chỉ cấm tài khoản</option>
            <option value="account_device">Tài khoản + thiết bị</option>
            <option value="device">Chỉ thiết bị</option>
            <option value="risk">Cấm rủi ro: tài khoản + thiết bị + IP prefix + trình duyệt</option>
          </select>
        </label>
        {banForm.banType === 'risk' && (
          <p className="admin-ban-note">
            Cấm rủi ro trên web sẽ chặn tài khoản, fingerprint trình duyệt hiện tại, IP prefix và chữ ký user-agent cùng lúc.
          </p>
        )}
        <label>Lý do
          <textarea value={banForm.reason} onChange={(event) => onChange({ reason: event.target.value })} />
        </label>
        <label>Hết hạn lúc (không bắt buộc)
          <input type="datetime-local" value={banForm.expiresAt} onChange={(event) => onChange({ expiresAt: event.target.value })} />
        </label>
        <button><Ban size={16} /> Xác nhận cấm</button>
      </form>
    </div>
  );
}
