import React from 'react';
import { CalendarClock, Crown, Trophy, Users } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';

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

export default function TournamentsSection({
  tournaments = [],
  tournamentForm,
  onChangeTournamentForm,
  onSubmitTournament,
  page,
  loading = false,
  totalPages,
  onPageChange,
  onChangeStatus
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Giải đấu</span>
          <h2>Tạo giải mở cho tất cả người chơi</h2>
        </div>
      </div>

      <form className="admin-editor-card admin-match-create admin-tournament-create" onSubmit={onSubmitTournament}>
        <div className="admin-editor-title">
          <div>
            <strong>Tạo giải đấu mới</strong>
            <small>Người chơi nhận thông báo, tham gia trong thời gian giới hạn và cạnh tranh trên bảng xếp hạng.</small>
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

        <label>
          Thể thức ghép cặp
          <select
            value={tournamentForm.pairingSystem}
            onChange={(event) => onChangeTournamentForm({ pairingSystem: event.target.value })}
          >
            <option value="arena">Arena</option>
            <option value="swiss">Swiss</option>
            <option value="round_robin">Vòng tròn</option>
          </select>
        </label>

        <label>
          Số người tối đa
          <input
            type="number"
            min="2"
            max="1000"
            value={tournamentForm.maxPlayers}
            onChange={(event) => onChangeTournamentForm({ maxPlayers: event.target.value })}
          />
        </label>

        <label className="admin-inline-check">
          <input
            type="checkbox"
            checked={tournamentForm.autoManage}
            onChange={(event) => onChangeTournamentForm({ autoManage: event.target.checked })}
          />
          Tự động mở giải và ghép cặp
        </label>

        <div className="admin-match-preview">
          <span><CalendarClock size={14} /> {tournamentForm.startsAt ? formatDate(tournamentForm.startsAt) : 'Mở ngay sau khi tạo'}</span>
          <span><Users size={14} /> Tất cả người chơi đều có thể tham gia</span>
          <span><Trophy size={14} /> Vinh danh top 1-2-3</span>
        </div>

        <button type="submit">Tạo giải và gửi thông báo</button>
      </form>

      <div className="admin-table-list">
        {loading && <LoadingBlock label="Đang tải danh sách giải đấu" />}
        {!loading && tournaments.length === 0 ? (
          <p className="admin-message">Chưa có giải đấu nào ở trang này.</p>
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
              <small>{item.players?.length || 0} người tham gia trong top hiển thị</small>
              <small>Tổng người tham gia: {item.playerCount ?? item.players?.length ?? 0} | Số ván đã ghi nhận: {item.totalGamesPlayed ?? 0}</small>
              <small>Thể thức: {item.pairing_system || 'arena'} | Tối đa: {item.max_players || 100} | Vòng: {item.current_round || 0}</small>
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
            <div className="admin-report-actions">
              {item.status === 'scheduled' && <button type="button" onClick={() => onChangeStatus(item, 'open')}>Mở đăng ký</button>}
              {['scheduled', 'open'].includes(item.status) && <button type="button" onClick={() => onChangeStatus(item, 'running')}>Bắt đầu</button>}
              {['open', 'running'].includes(item.status) && <button type="button" onClick={() => onChangeStatus(item, 'finished')}>Kết thúc</button>}
              {item.status !== 'cancelled' && item.status !== 'finished' && <button type="button" className="danger" onClick={() => onChangeStatus(item, 'cancelled')}>Hủy giải</button>}
            </div>
          </article>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang giải đấu"
      />
    </section>
  );
}
