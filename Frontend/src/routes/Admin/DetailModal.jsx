import React from 'react';
import { time } from './adminUtils';

function DetailContent({ selectedDetail, onClose }) {
  if (!selectedDetail) {
    return (
      <section className="admin-panel admin-detail-panel">
        <p>Chon mot nguoi choi o muc Nguoi choi de xem thiet bi, lenh cam va replay gan day.</p>
      </section>
    );
  }

  return (
    <section className="admin-panel admin-detail-panel">
      <div className="admin-panel-head">
        <div>
          <span>Chi tiet nguoi choi</span>
          <h2>{selectedDetail.user.display_name}</h2>
        </div>
        <button onClick={onClose}>Dong</button>
      </div>
      <div className="admin-detail-grid">
        <div>
          <strong>Bao mat / rui ro</strong>
          <p>
            Thiet bi moi nhat: {selectedDetail.devices[0]?.device_fingerprint?.slice(0, 24) || '--'}
            <br />
            <small>IP prefix: {selectedDetail.devices[0]?.ip_prefix || '--'} | UA signature: {selectedDetail.devices[0]?.user_agent_hash?.slice(0, 18) || '--'}</small>
          </p>
          <p>
            Bao cao: {selectedDetail.reports.length}
            <br />
            <small>Rui ro cao nhat: {Math.max(0, ...selectedDetail.reports.map((report) => Number(report.risk_score || 0)))}/100</small>
          </p>
        </div>
        <div>
          <strong>Lich su thiet bi/IP</strong>
          {selectedDetail.devices.length === 0 && <p>Chua co fingerprint.</p>}
          {selectedDetail.devices.map((device) => (
            <p key={device.id}>{device.device_fingerprint}<br /><small>IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 18) || '--'} | {time(device.last_seen_at)}</small><br /><small>{device.user_agent || 'unknown'}</small></p>
          ))}
        </div>
        <div>
          <strong>Lich su cam</strong>
          {selectedDetail.bans.length === 0 && <p>Chua co lenh cam.</p>}
          {selectedDetail.bans.map((ban) => (
            <p key={ban.id}>{ban.status} | {ban.ban_type}<br /><small>{ban.reason}</small>{ban.ip_prefix && <><br /><small>Risk: IP {ban.ip_prefix} | UA {ban.user_agent_hash?.slice(0, 18) || '--'}</small></>}</p>
          ))}
        </div>
      </div>
      <div className="admin-game-replay-list">
        <strong>Replay gan day</strong>
        {selectedDetail.games.map((game) => (
          <details key={game.id} className="admin-replay-card">
            <summary>{game.white.name} vs {game.black.name} | {game.result || '*'} | {(game.moves || []).length} moves</summary>
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
