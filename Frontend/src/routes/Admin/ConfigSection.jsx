import React from 'react';
import { Save, Settings } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import { BOARD_PRESETS } from '../../game/constants';

export default function ConfigSection({ admin, config, testAdmin, loading = false, onSave, onGrantTestAdmin, onRevokeTestAdmin }) {
  const [form, setForm] = React.useState(config || {});
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setForm(config || {}); }, [config]);
  const canManageTestAdmin = !admin?.isTestAdmin;
  const expiresLabel = testAdmin?.expiresAt ? new Date(testAdmin.expiresAt).toLocaleString('vi-VN') : '';
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try { await onSave?.(form); } finally { setSaving(false); }
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div><span><Settings size={16} /> Thiết lập công khai</span><h2>Website Settings</h2><p>Chỉ gồm các giá trị có ý nghĩa với giao diện và người dùng. Khóa bí mật không xuất hiện tại đây.</p></div>
      </div>
      {loading && <LoadingBlock label="Đang tải cài đặt website" />}
      {!loading && (
        <form className="admin-settings-form" onSubmit={submit}>
          <fieldset>
            <legend>Giao diện</legend>
            <label>Tên website<input value={form.siteTitle || ''} maxLength={80} onChange={(event) => update('siteTitle', event.target.value)} /></label>
            <label>Màu nhấn<input type="color" value={form.accentColor || '#7c3aed'} onChange={(event) => update('accentColor', event.target.value)} /></label>
            <label>Chế độ mặc định<select value={form.defaultAppearance || 'system'} onChange={(event) => update('defaultAppearance', event.target.value)}><option value="system">Theo hệ thống</option><option value="dark">Tối</option><option value="light">Sáng</option></select></label>
            <p>Áp dụng cho người chưa tự chọn giao diện. Lựa chọn cá nhân được giữ nguyên.</p>
          </fieldset>
          <fieldset>
            <legend>Cờ vua</legend>
            <label>Giao diện bàn cờ mặc định<select value={form.defaultBoardTheme || 'classic'} onChange={(event) => update('defaultBoardTheme', event.target.value)}>{BOARD_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          </fieldset>
          <fieldset>
            <legend>Thông tin chung</legend>
            <label>Mô tả website<textarea value={form.siteDescription || ''} maxLength={300} onChange={(event) => update('siteDescription', event.target.value)} /></label>
            <label>Chủ sở hữu công khai<input value={form.ownerName || ''} maxLength={120} onChange={(event) => update('ownerName', event.target.value)} placeholder="Để trống nếu chưa công bố" /></label>
            <label>Người phát triển công khai<input value={form.developerName || ''} maxLength={120} onChange={(event) => update('developerName', event.target.value)} placeholder="Để trống nếu chưa công bố" /></label>
            <label>Email hỗ trợ<input type="email" value={form.supportEmail || ''} maxLength={160} onChange={(event) => update('supportEmail', event.target.value)} /></label>
            <label>Thông báo trang chủ<textarea value={form.homepageAnnouncement || ''} maxLength={500} onChange={(event) => update('homepageAnnouncement', event.target.value)} /></label>
            <label>Thông báo bảo trì<textarea required={form.showMaintenanceBanner === true} value={form.maintenanceMessage || ''} maxLength={300} onChange={(event) => update('maintenanceMessage', event.target.value)} /></label>
            <label className="admin-check"><input type="checkbox" checked={form.showMaintenanceBanner === true} onChange={(event) => update('showMaintenanceBanner', event.target.checked)} /> Hiển thị thông báo bảo trì</label>
            <p>Thông báo xuất hiện phía trên website; người chơi vẫn sử dụng bình thường. Khi hoàn tất bảo trì, bỏ chọn rồi lưu để ẩn thông báo. Trang đang mở cập nhật trong khoảng 30 giây.</p>
          </fieldset>
          <button type="submit" disabled={saving}><Save size={16} /> {saving ? 'Đang lưu…' : 'Lưu Website Settings'}</button>
        </form>
      )}
      <div className="admin-panel-head admin-test-access-head">
        <div><span>Admin test</span><h2>{testAdmin?.email || 'admintest@gmail.com'}</h2><p>Trạng thái: {testAdmin?.granted ? 'đã được cấp quyền' : 'đang khóa'}{testAdmin?.enabled ? '' : ' · tài khoản test đang tắt'}{testAdmin?.granted && expiresLabel ? ` · hết hạn: ${expiresLabel}` : ''}</p></div>
        {canManageTestAdmin && <div className="admin-actions"><button type="button" onClick={onGrantTestAdmin} disabled={!testAdmin?.enabled || testAdmin?.granted}>Cấp quyền 24h</button><button type="button" onClick={onRevokeTestAdmin} disabled={!testAdmin?.enabled || !testAdmin?.granted}>Thu hồi</button></div>}
      </div>
    </section>
  );
}
