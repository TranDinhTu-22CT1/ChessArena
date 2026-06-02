import React from 'react';
import { Ban, ShieldAlert } from 'lucide-react';

function banTypeLabel(type) {
  if (type === 'account_device') return 'Tài khoản + thiết bị';
  if (type === 'device') return 'Chỉ thiết bị';
  if (type === 'risk') return 'Cấm rủi ro mở rộng';
  return 'Chỉ tài khoản';
}

export default function BanModal({
  banTarget,
  banForm,
  onSubmit,
  onClose,
  onChange
}) {
  if (!banTarget) return null;

  const device = banTarget.devices?.[0] || {};
  const hasDevice = Boolean(device.device_fingerprint);
  const targetName = banTarget.display_name || banTarget.username || banTarget.email || banTarget.id;

  return (
    <div className="admin-modal-layer" role="dialog" aria-modal="true">
      <form className="admin-modal admin-ban-form" onSubmit={onSubmit}>
        <div className="admin-panel-head">
          <div>
            <span>{banTypeLabel(banForm.banType)}</span>
            <h2>{targetName}</h2>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </div>

        <div className="admin-ban-preview">
          <ShieldAlert size={18} />
          <div>
            <strong>Kiểm tra trước khi cấm</strong>
            <span>User ID: {banTarget.id}</span>
            <span>Email: {banTarget.email || '--'}</span>
            <span>Device: {hasDevice ? `${device.device_fingerprint.slice(0, 18)}...` : 'chưa có fingerprint'}</span>
            <span>IP prefix: {device.ip_prefix || '--'} | UA: {device.user_agent_hash?.slice(0, 12) || '--'}</span>
          </div>
        </div>

        <label>Kiểu cấm
          <select value={banForm.banType} onChange={(event) => onChange({ banType: event.target.value })}>
            <option value="account">Chỉ cấm tài khoản</option>
            <option value="account_device">Tài khoản + thiết bị</option>
            <option value="device">Chỉ thiết bị</option>
            <option value="risk">Rủi ro: tài khoản + thiết bị + IP prefix + trình duyệt</option>
          </select>
        </label>

        {!hasDevice && banForm.banType !== 'account' && (
          <p className="admin-ban-note">
            Tài khoản này chưa có tín hiệu thiết bị đủ rõ. Backend sẽ tự fallback về cấm tài khoản nếu không đủ dữ liệu.
          </p>
        )}

        {banForm.banType === 'risk' && (
          <p className="admin-ban-note">
            Cấm rủi ro dùng đồng thời tài khoản, fingerprint, IP prefix và user-agent hash. Chỉ dùng khi đã có căn cứ rõ từ anti-cheat.
          </p>
        )}

        <label>Lý do
          <textarea value={banForm.reason} onChange={(event) => onChange({ reason: event.target.value })} />
        </label>
        <label>Hết hạn lúc (không bắt buộc)
          <input type="datetime-local" value={banForm.expiresAt} onChange={(event) => onChange({ expiresAt: event.target.value })} />
        </label>
        <button className="danger"><Ban size={16} /> Xác nhận cấm</button>
      </form>
    </div>
  );
}
