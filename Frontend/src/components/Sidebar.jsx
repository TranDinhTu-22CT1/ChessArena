import React from 'react';
import {
  BarChart3,
  Bot,
  ChevronRight,
  Crown,
  Dumbbell,
  GraduationCap,
  History,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Puzzle,
  Radio,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
  Zap
} from 'lucide-react';

const menuItems = [
  { icon: Swords, label: 'Play', active: true, hasFlyout: true },
  { icon: Puzzle, label: 'Puzzles' },
  { icon: GraduationCap, label: 'Learn' },
  { icon: Dumbbell, label: 'Train' },
  { icon: Radio, label: 'Watch' },
  { icon: Users, label: 'Community' },
  { icon: MoreHorizontal, label: 'Other' }
];

const playMenuItems = [
  { icon: Swords, label: 'Play Online', disabled: true, note: 'Sắp có' },
  { icon: Bot, label: 'Play Bots' },
  { icon: MessageSquare, label: 'Play Coach' },
  { divider: true },
  { icon: BarChart3, label: 'Stats' },
  { icon: Trophy, label: 'Tournaments' },
  { icon: Zap, label: 'Variants' },
  { icon: History, label: 'Game History' }
];

export default function Sidebar({
  authUser,
  userName,
  activeRoute,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
  onNavigate,
  onLogin,
  onRegister,
  onLogout
}) {
  const handleNavigate = (nextRoute) => {
    onNavigate?.(nextRoute);
    onCloseMobile?.();
  };

  return (
    <>
      <button className="mobile-sidebar-toggle" onClick={onToggleMobile} aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}>
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <button
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={onCloseMobile}
        aria-label="Đóng menu"
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
      <button className="logo-lockup" onClick={() => handleNavigate('home')}>
        <div className="logo-mark">
          <Crown size={22} />
        </div>
        <div>
          <strong>Chess Arena</strong>
          <span>Local beta</span>
        </div>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.hasFlyout ? activeRoute === 'game' : item.active;
          return (
            <div className={`nav-item ${isActive ? 'active' : ''} ${item.hasFlyout ? 'has-flyout' : ''}`} key={item.label}>
              <button className={isActive ? 'active' : ''} onClick={() => item.hasFlyout && handleNavigate('game')}>
                <Icon size={20} />
                <span>{item.label}</span>
                {item.hasFlyout && <ChevronRight size={17} />}
              </button>
              {item.hasFlyout && (
                <div className="play-flyout" aria-label="Play menu">
                  {playMenuItems.map((playItem, index) => {
                    if (playItem.divider) return <hr key={`divider-${index}`} />;
                    const PlayIcon = playItem.icon;
                    return (
                      <button
                        key={playItem.label}
                        disabled={playItem.disabled}
                        title={playItem.note}
                        onClick={() => {
                          if (playItem.disabled) return;
                          handleNavigate(playItem.label === 'Game History' ? 'review' : 'game');
                        }}
                      >
                        <PlayIcon size={20} />
                        <span>{playItem.label}</span>
                        {playItem.note && <small>{playItem.note}</small>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button className="sidebar-offer">
        <Crown size={18} />
        Get 50% Off
      </button>

      <div className="sidebar-account">
        <div className="sidebar-card">
          <Shield size={22} />
          <div>
            <strong>{authUser ? userName : 'Guest'}</strong>
            <span>{authUser ? 'Signed in' : 'Not signed in'}</span>
          </div>
        </div>

        <div className="sidebar-auth">
          {authUser ? (
            <button onClick={() => {
              onLogout?.();
              onCloseMobile?.();
            }}>
              <LogOut size={18} />
              Sign out
            </button>
          ) : (
            <>
              <button onClick={() => {
                onLogin?.();
                onCloseMobile?.();
              }}>
                <Lock size={18} />
                Sign in
              </button>
              <button onClick={() => {
                onRegister?.();
                onCloseMobile?.();
              }}>Register</button>
            </>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
