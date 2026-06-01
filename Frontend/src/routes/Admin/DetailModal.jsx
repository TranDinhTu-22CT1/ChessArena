import React from 'react';
import { time } from './adminUtils';

function DetailContent({ selectedDetail, onClose }) {
  if (!selectedDetail) {
    return (
      <section className="admin-panel admin-detail-panel">
        <p>Chọn một người chơi ở mục Người chơi để xem thiết bị, lệnh cấm và replay gần đây.</p>
      </section>
    );
  }

  return (
    <section className="admin-panel admin-detail-panel">
      <div className="admin-panel-head">
        <div>
          <span>Chi tiết người chơi</span>
          <h2>{selectedDetail.user.display_name}</h2>
        </div>
        <button onClick={onClose}>Đóng</button>
      </div>
      <div className="admin-detail-grid">
        <div className={selectedDetail.diagnostics?.splitAccount ? 'admin-diagnostic-card danger' : 'admin-diagnostic-card ok'}>
          <strong>Account diagnostics</strong>
          <p>
            Linked IDs: {selectedDetail.diagnostics?.relatedUserIds?.length || 1}
            <br />
            <small>Completed games: {selectedDetail.diagnostics?.completedGamesFound ?? selectedDetail.games.length} | Active: {selectedDetail.diagnostics?.activeGamesFound ?? 0}</small>
          </p>
          {(selectedDetail.diagnostics?.relatedUsers || []).map((user) => (
            <p key={user.id}>
              {user.display_name || user.username}
              <br />
              <small>{user.id}</small>
              <br />
              <small>{user.email || '--'} | {user.firebase_uid || '--'}</small>
            </p>
          ))}
        </div>
        <div>
          <strong>Bảo mật / rủi ro</strong>
          <p>
            Thiết bị mới nhất: {selectedDetail.devices[0]?.device_fingerprint?.slice(0, 24) || '--'}
            <br />
            <small>IP prefix: {selectedDetail.devices[0]?.ip_prefix || '--'} | UA signature: {selectedDetail.devices[0]?.user_agent_hash?.slice(0, 18) || '--'}</small>
          </p>
          <p>
            Báo cáo: {selectedDetail.reports.length}
            <br />
            <small>Rủi ro cao nhất: {Math.max(0, ...selectedDetail.reports.map((report) => Number(report.risk_score || 0)))}/100</small>
          </p>
        </div>
        <div>
          <strong>Lịch sử thiết bị/IP</strong>
          {selectedDetail.devices.length === 0 && <p>Chưa có fingerprint.</p>}
          {selectedDetail.devices.map((device) => (
            <p key={device.id}>{device.device_fingerprint}<br /><small>IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 18) || '--'} | {time(device.last_seen_at)}</small><br /><small>{device.user_agent || 'không rõ'}</small></p>
          ))}
        </div>
        <div>
          <strong>Lịch sử cấm</strong>
          {selectedDetail.bans.length === 0 && <p>Chưa có lệnh cấm.</p>}
          {selectedDetail.bans.map((ban) => (
            <p key={ban.id}>{ban.status} | {ban.ban_type}<br /><small>{ban.reason}</small>{ban.ip_prefix && <><br /><small>Risk: IP {ban.ip_prefix} | UA {ban.user_agent_hash?.slice(0, 18) || '--'}</small></>}</p>
          ))}
        </div>
      </div>
      <div className="admin-game-replay-list">
        <strong>Replay gần đây</strong>
        {selectedDetail.games.map((game) => (
          <details key={game.id} className="admin-replay-card">
            <summary>{game.white.name} vs {game.black.name} | {game.result || '*'} | {(game.moves || []).length} nước</summary>
            <div className="admin-replay-moves">
              {(game.moves || []).map((move) => <span key={move.ply}>{move.ply}. {move.san}</span>)}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function DetailModal({ selectedDetail, onClose }) {
  if (!selectedDetail) return null;
  return (
    <div className="admin-modal-layer" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <DetailContent selectedDetail={selectedDetail} onClose={onClose} />
      </div>
    </div>
  );
}
