import React from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import Modal from '../../components/Modal';

export default function BanModal({ banTarget, banForm, onSubmit, onClose, onChange }) {
  if (!banTarget) return null;
  const name = banTarget.display_name || banTarget.username || banTarget.email;
  return <Modal open className="admin-modal-layer" onClose={onClose} aria-label="Khóa tài khoản">
    <form className="admin-modal admin-ban-form" onSubmit={onSubmit}>
      <div className="admin-panel-head"><div><span>Khóa tài khoản</span><h2>{name}</h2></div><button type="button" className="admin-button-secondary" onClick={onClose}>Đóng</button></div>
      <div className="admin-ban-preview"><ShieldAlert size={22} /><div><strong>Tài khoản sẽ không thể đăng nhập</strong><span>{banTarget.email}</span><span>Người chơi có thể gửi yêu cầu xem xét qua màn hình thông báo khóa. Admin duyệt tại mục Hỗ trợ.</span></div></div>
      <label>Lý do khóa<textarea required maxLength={300} value={banForm.reason} onChange={event => onChange({ reason: event.target.value })} /></label>
      <label>Thời điểm mở lại<input type="datetime-local" value={banForm.expiresAt} onChange={event => onChange({ expiresAt: event.target.value })} /><small>Để trống nếu không đặt thời hạn.</small></label>
      <button className="danger admin-button-danger"><Ban size={16} /> Xác nhận khóa tài khoản</button>
    </form>
  </Modal>;
}
