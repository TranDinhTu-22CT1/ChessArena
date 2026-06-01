import React from 'react';
import { gameModeLabel, gameStatusLabel, resultLabel, time } from './adminUtils';

export default function MatchesSection({ matches }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Quản lý trận đấu</span>
          <h2>Các trận online gần đây</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {matches.map((match) => (
          <article className="admin-report-card" key={match.id}>
            <div>
              <strong>{match.white_name || 'Trắng'} đấu với {match.black_name || 'Đen'}</strong>
              <span>
                Trạng thái: {gameStatusLabel(match.status)}
                {' | '}Kết quả: {resultLabel(match.result)}
                {' | '}Chế độ: {gameModeLabel(match.mode)}
                {' | '}Thời gian: {match.time_control || '--'}
                {' | '}Số nước: {match.moveCount ?? 0}
              </span>
              <small>Mã trận: {match.id} | Tạo lúc: {time(match.created_at)} | Cập nhật: {time(match.updated_at)}</small>
              <em>Nước cuối: {(match.lastMoves || []).map((move) => move.san).join(' ') || 'Chưa có nước đi'}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
