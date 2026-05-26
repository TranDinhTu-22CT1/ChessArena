import React from 'react';
import { Bell, Brain, Flame, Settings, Sparkles, Target, Wifi, WifiOff } from 'lucide-react';
import { BOARD_PRESETS, PIECE_SETS } from '../game/constants';

const puzzleRoutes = new Set(['puzzles', 'daily-puzzle', 'puzzle-rush', 'puzzle-battle', 'custom-puzzles']);
const playRoutes = new Set(['bot', 'player', 'coach', 'custom']);

const puzzleTips = [
  'Tìm nước chiếu, bắt quân, đe dọa trước.',
  'Nếu có nhiều nước hay, ưu tiên nước ép vua đối thủ.',
  'Trong tàn cuộc, kích hoạt vua trước khi đẩy tốt.',
  'Ở trung cuộc, hãy nhìn các quân đang bị ghim hoặc quá tải.'
];

const playTips = [
  'Phát triển quân nhẹ trước khi mở trung tâm.',
  'Khi đối thủ đe dọa, tìm nước phản công có tempo.',
  'Nhìn an toàn vua trước khi tham quân.',
  'Đừng đổi quân khi bạn đang tấn công mạnh.'
];

const reviewTips = [
  'Tập trung vào nước làm đổi đánh giá nhiều nhất.',
  'So sánh nước đã đi với gợi ý engine ở cùng thế.',
  'Ghi nhớ mẫu sai lặp lại để sửa ở ván sau.'
];

function dailyPick(items) {
  return items[new Date().getDate() % items.length];
}

function headerInsights(activeRoute) {
  if (puzzleRoutes.has(activeRoute)) {
    return [
      { icon: Target, label: 'Puzzle focus', text: dailyPick(puzzleTips) },
      { icon: Flame, label: 'Streak', text: activeRoute === 'puzzle-rush' ? '3 phút, tối đa 3 lỗi.' : 'Giải đúng liên tiếp để tăng điểm nhanh.' }
    ];
  }

  if (playRoutes.has(activeRoute)) {
    return [
      { icon: activeRoute === 'coach' ? Sparkles : Brain, label: activeRoute === 'coach' ? 'Coach' : 'Game plan', text: activeRoute === 'coach' ? 'Coach sẽ nhắc kế hoạch theo thế cờ.' : dailyPick(playTips) }
    ];
  }

  if (activeRoute === 'review') {
    return [
      { icon: Brain, label: 'Review', text: dailyPick(reviewTips) },
      { icon: Target, label: 'Goal', text: 'Tìm một lỗi chính và một nước tốt nhất.' }
    ];
  }

  return [
    { icon: Sparkles, label: 'Today', text: 'Chọn chế độ luyện và bắt đầu một ván mới.' },
    { icon: Target, label: 'Board', text: 'Có thể đổi màu bàn cờ trong Settings.' }
  ];
}

export default function TopHeader({
  activeRoute,
  apiOnline,
  settingsOpen,
  theme,
  pieceSet,
  authUser,
  onToggleSettings,
  onResetTheme,
  onUpdateTheme,
  onApplyBoardPreset,
  onSetPieceSet
}) {
  const insights = headerInsights(activeRoute);

  return (
    <header className="top-header">
      <div className="top-insight-cluster" aria-label="Page insights">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div className="top-insight" key={item.label}>
              <Icon size={18} />
              <span>
                <strong>{item.label}</strong>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
      <div className="header-actions">
        <span className={`api-pill ${apiOnline ? 'online' : 'offline'}`}>
          {apiOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          API
        </span>
        <button aria-label="Notifications">
          <Bell size={19} />
        </button>
        <button aria-label="Settings" onClick={onToggleSettings}>
          <Settings size={19} />
        </button>
      </div>
      {settingsOpen && (
        <div className="theme-panel">
          <div className="theme-panel-head">
            <strong>Cá nhân hóa giao diện</strong>
            <button onClick={onResetTheme}>Đặt lại</button>
          </div>
          <label>
            <span>Màu nhấn</span>
            <input type="color" value={theme.accent} onChange={(event) => onUpdateTheme('accent', event.target.value)} />
          </label>
          <label>
            <span>Ô sáng</span>
            <input type="color" value={theme.lightSquare} onChange={(event) => onUpdateTheme('lightSquare', event.target.value)} />
          </label>
          <label>
            <span>Ô tối</span>
            <input type="color" value={theme.darkSquare} onChange={(event) => onUpdateTheme('darkSquare', event.target.value)} />
          </label>
          <label>
            <span>Bảng điều khiển</span>
            <input type="color" value={theme.surface} onChange={(event) => onUpdateTheme('surface', event.target.value)} />
          </label>
          <label>
            <span>Nền trang</span>
            <input type="color" value={theme.page} onChange={(event) => onUpdateTheme('page', event.target.value)} />
          </label>
          <label>
            <span>Preset bàn cờ</span>
            <select onChange={(event) => onApplyBoardPreset(event.target.value)} defaultValue="">
              <option value="" disabled>Chọn preset</option>
              {BOARD_PRESETS.map((preset) => (
                <option value={preset.id} key={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Mẫu quân cờ</span>
            <select value={pieceSet} onChange={(event) => onSetPieceSet(event.target.value)}>
              {PIECE_SETS.map((set) => (
                <option value={set.id} key={set.id}>{set.label}</option>
              ))}
            </select>
          </label>
          <p className="theme-note">
            {authUser ? 'Màu sẽ được lưu theo tài khoản của bạn.' : 'Đăng nhập để đồng bộ màu trên tài khoản.'}
          </p>
        </div>
      )}
    </header>
  );
}
