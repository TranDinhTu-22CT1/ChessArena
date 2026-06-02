import React from 'react';
import { CalendarClock, Crown, Trophy, Users } from 'lucide-react';
import { gameModeLabel, gameStatusLabel, resultLabel, time } from './adminUtils';

const TIME_CONTROLS = [
  ['180+0', 'Blitz 3+0'],
  ['300+0', 'Blitz 5+0'],
  ['600+0', 'Rapid 10+0'],
  ['900+10', 'Rapid 15+10']
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Mở ngay';
}

function statusLabel(status) {
  const labels = {
    scheduled: 'Sắp diễn ra',
    open: 'Đang mở đăng ký',
    running: 'Đang thi đấu',
    finished: 'Đã kết thúc',
    cancelled: 'Đã hủy'
  };
  return labels[status] || status || '--';
}

function topPlayers(players = []) {
  return players.slice(0, 3);
}

export default function MatchesSection({
  matches,
  tournaments = [],
  tournamentForm,
  onChangeTournamentForm,
  onSubmitTournament
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Trận đấu và giải đấu</span>
          <h2>Tạo giải đấu mở cho tất cả người chơi</h2>
        </div>
      </div>

      <form className="admin-editor-card admin-match-create admin-tournament-create" onSubmit={onSubmitTournament}>
        <div className="admin-editor-title">
          <div>
            <strong>Tạo giải đấu mới</strong>
            <small>Người chơi sẽ nhận thông báo, tham gia trong thời gian giới hạn và cạnh tranh trên bảng xếp hạng.</small>
          </div>
        </div>

        <label>
          Tên giải đấu
          <input
            required
            value={tournamentForm.title}
            onChange={(event) => onChangeTournamentForm({ title: event.target.value })}
            placeholder="Ví dụ: Giải nhanh tối nay"
          />
        </label>

        <label>
          Thể loại ván
          <select
            value={tournamentForm.timeControl}
            onChange={(event) => onChangeTournamentForm({ timeControl: event.target.value })}
          >
            {TIME_CONTROLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label>
          Thời lượng giải (phút)
          <input
            type="number"
            min="10"
            max="240"
            value={tournamentForm.durationMinutes}
            onChange={(event) => onChangeTournamentForm({ durationMinutes: event.target.value })}
          />
        </label>

        <label>
          Bắt đầu lúc
          <input
            type="datetime-local"
            value={tournamentForm.startsAt}
            onChange={(event) => onChangeTournamentForm({ startsAt: event.target.value })}
          />
        </label>

        <div className="admin-match-preview">
          <span><CalendarClock size={14} /> {tournamentForm.startsAt ? formatDate(tournamentForm.startsAt) : 'Mở ngay sau khi tạo'}</span>
          <span><Users size={14} /> Tất cả người chơi đều có thể tham gia</span>
          <span><Trophy size={14} /> Vinh danh top 1-2-3</span>
        </div>

        <button type="submit">Tạo giải và gửi thông báo</button>
      </form>

      <div className="admin-content-grid">
        <section className="admin-editor-card">
          <div className="admin-editor-title">
            <div>
              <strong>Giải đấu đang có</strong>
              <small>Theo dõi đăng ký, thời gian và top đầu của từng giải.</small>
            </div>
          </div>
          <div className="admin-table-list">
            {tournaments.length === 0 ? (
              <p className="admin-message">Chưa có giải đấu nào.</p>
            ) : tournaments.map((item) => (
              <article className="admin-report-card" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {statusLabel(item.status)}
                    {' | '}Thể loại: {item.time_control}
                    {' | '}Bắt đầu: {formatDate(item.starts_at)}
                    {' | '}Kết thúc: {formatDate(item.ends_at)}
                  </span>
                  <small>{item.players?.length || 0} người tham gia</small>
                  <div className="admin-podium-list">
                    {topPlayers(item.players).length === 0 ? (
                      <em>Chưa có người chơi trên bảng xếp hạng.</em>
                    ) : topPlayers(item.players).map((player, index) => (
                      <b key={player.user_id}>
                        <Crown size={14} /> Top {index + 1}: {player.display_name} - {player.score} điểm
                      </b>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-editor-card">
          <div className="admin-editor-title">
            <div>
              <strong>Trận online gần đây</strong>
              <small>Dùng để theo dõi hoạt động thi đấu đang diễn ra trên hệ thống.</small>
            </div>
          </div>
          <div className="admin-table-list">
            {matches.map((match) => (
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
                  <small>Tạo lúc: {time(match.created_at)} | Cập nhật: {time(match.updated_at)}</small>
                  <em>Nước cuối: {(match.lastMoves || []).map((move) => move.san).join(' ') || 'Chưa có nước đi'}</em>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
