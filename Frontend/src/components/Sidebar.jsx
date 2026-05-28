import React from 'react';
import BrandMark from './BrandMark';
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronRight,
  Crown,
  History,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Puzzle,
  Shield,
  Swords,
  Trophy,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { membershipPlan } from '../membership/plans';

const menuItems = [
  { icon: Swords, label: 'Play', active: true, hasFlyout: true },
  { icon: Puzzle, label: 'Puzzles', route: 'puzzles', hasPuzzleFlyout: true },
  { icon: Crown, label: 'Premium', route: 'membership' }
];

const playMenuItems = [
  { icon: Swords, label: 'Chơi online', route: 'online' },
  { icon: Bot, label: 'Chơi với bot', route: 'bot' },
  { icon: MessageSquare, label: 'Play Coach', route: 'coach' },
  { divider: true },
  { icon: Trophy, label: 'Leaderboard', route: 'leaderboard' },
  { icon: BarChart3, label: 'Profile', route: 'profile' },
  { icon: History, label: 'Game History', route: 'history' }
];

const puzzleMenuItems = [
  { icon: Puzzle, label: 'Puzzles', route: 'puzzles' },
  { icon: CalendarDays, label: 'Daily Puzzle', route: 'daily-puzzle' },
  { icon: Zap, label: 'Puzzle Rush', route: 'puzzle-rush' },
  { icon: Trophy, label: 'Custom Puzzles', route: 'custom-puzzles' }
];

export default function Sidebar({
  authUser,
  userName,
  activeRoute,
  membership,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
  onNavigate,
  onSelectPlayMode,
  onLogin,
  onRegister,
  onLogout
}) {
  const [openFlyout, setOpenFlyout] = React.useState(null);
  const plan = membershipPlan(membership);

  const handleNavigate = (nextRoute) => {
    setOpenFlyout(null);
    onNavigate?.(nextRoute);
    onCloseMobile?.();
  };

  return (
    <>
      <button className="mobile-sidebar-toggle" onClick={onToggleMobile} aria-label={mobileOpen ? '\u0110\u00f3ng menu' : 'M\u1edf menu'}>
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <button
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={onCloseMobile}
        aria-label="\u0110\u00f3ng menu"
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
      <button className="logo-lockup" onClick={() => handleNavigate('home')}>
        <BrandMark className="logo-mark-image" />
        <div>
          <strong>Chess Arena</strong>
          <span>Local beta</span>
        </div>
      </button>

      <nav className="main-nav" aria-label="Main navigation">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.hasFlyout
            ? ['online', 'bot', 'coach', 'local', 'review', 'history', 'leaderboard'].includes(activeRoute)
            : item.hasPuzzleFlyout
              ? ['puzzles', 'daily-puzzle', 'puzzle-rush', 'puzzle-battle', 'custom-puzzles'].includes(activeRoute)
              : item.route === activeRoute || item.active;
          return (
            <div className={`nav-item ${isActive ? 'active' : ''} ${(item.hasFlyout || item.hasPuzzleFlyout) ? 'has-flyout' : ''} ${openFlyout === item.label ? 'open' : ''}`} key={item.label}>
              <button className={isActive ? 'active' : ''} onClick={() => {
                if (item.hasFlyout || item.hasPuzzleFlyout) {
                  setOpenFlyout((current) => current === item.label ? null : item.label);
                } else if (item.route) handleNavigate(item.route);
              }}>
                <Icon size={20} />
                <span>{item.label}</span>
                {(item.hasFlyout || item.hasPuzzleFlyout) && <ChevronRight size={17} />}
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
                          if (playItem.route) onSelectPlayMode?.(playItem.route);
                          handleNavigate(playItem.route ?? 'bot');
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
              {item.hasPuzzleFlyout && (
                <div className="play-flyout puzzle-flyout" aria-label="Puzzles menu">
                  {puzzleMenuItems.map((puzzleItem) => {
                    const PuzzleIcon = puzzleItem.icon;
                    return (
                      <button key={puzzleItem.route} onClick={() => handleNavigate(puzzleItem.route)}>
                        <PuzzleIcon size={20} />
                        <span>{puzzleItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button className="sidebar-offer" onClick={() => handleNavigate('membership')}>
        <Crown size={18} />
        {plan.id === 'free' ? 'Upgrade Premium' : `${plan.badge} active`}
      </button>

      <div className="sidebar-account">
        <div className="sidebar-card">
          {authUser?.photoURL ? <img className="sidebar-avatar" src={authUser.photoURL} alt="" /> : <Shield size={22} />}
          <div>
            <strong>{authUser ? userName : 'Guest'}</strong>
            <span>{authUser ? 'Signed in' : 'Not signed in'}</span>
          </div>
        </div>

        <div className="sidebar-auth">
          {authUser ? (
            <>
              <button onClick={() => handleNavigate('profile')}>
                <UserRound size={18} />
                Hồ sơ
              </button>
              <button onClick={() => {
                onLogout?.();
                onCloseMobile?.();
              }}>
                <LogOut size={18} />
                Sign out
              </button>
            </>
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
