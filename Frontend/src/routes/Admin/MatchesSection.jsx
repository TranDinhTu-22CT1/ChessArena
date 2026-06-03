import React from 'react';
import Pagination from '../../components/Pagination';
import { gameModeLabel, gameStatusLabel, resultLabel, time } from './adminUtils';

function isStale(match) {
  return match.status === 'active' && match.updated_at && Date.now() - new Date(match.updated_at).getTime() > 15 * 60 * 1000;
}

export default function MatchesSection({ matches, page, totalPages, onPageChange, onChangeStatus }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Trận đấu</span>
          <h2>Theo dõi các trận online gần đây</h2>
        </div>
      </div>

      <div className="admin-table-list">
        {matches.length === 0 ? (
          <p className="admin-message">Chưa có trận đấu nào ở trang này.</p>
        ) : matches.map((match) => (
          <article className="admin-report-card" key={match.id}>
            <div>
              <strong>{match.white_name || 'Trắng'} vs {match.black_name || 'Đen'}</strong>
              <span>
                {gameStatusLabel(match.status)}
                {' | '}Kết quả: {resultLabel(match.result)}
                {' | '}Chế độ: {gameModeLabel(match.mode)}
                {' | '}Thời gian: {match.time_control || '--'}
                {' | '}Số nước: {match.moveCount ?? 0}
              </span>
              <small>Mã mời: {match.invite_code || '--'} | Rated: {match.rated ? 'Có' : 'Không'} | Vé ghép: {match.matchmaking_ticket_white || match.matchmaking_ticket_black ? 'Có' : 'Không'}</small>
              <small>Tạo lúc: {time(match.created_at)} | Cập nhật: {time(match.updated_at)}</small>
              {isStale(match) && <b className="admin-ban-note">Trận có dấu hiệu treo quá 15 phút.</b>}
              <em>Nước cuối: {(match.lastMoves || []).map((move) => move.san).join(' ') || 'Chưa có nước đi'}</em>
            </div>
            <div className="admin-report-actions">
              {['waiting', 'active'].includes(match.status) && (
                <button type="button" onClick={() => onChangeStatus(match, 'abandoned')}>Hủy/đánh dấu bỏ ván</button>
              )}
              {match.status === 'active' && (
                <button type="button" onClick={() => onChangeStatus(match, 'draw')}>Kết thúc hòa</button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang trận đấu"
      />
    </section>
  );
}
