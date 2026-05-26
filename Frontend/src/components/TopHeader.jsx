import React from 'react';
import { Bell, Search, Settings, Wifi, WifiOff } from 'lucide-react';
import { BOARD_PRESETS, PIECE_SETS } from '../game/constants';

export default function TopHeader({
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
  return (
    <header className="top-header">
      <div className="search-box">
        <Search size={18} />
        <span>Search players, games, openings</span>
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
