import React from 'react';
import BrandMark from './BrandMark';
import {
  BarChart3,
  Bell,
  Bot,
  Brain,
  BookOpen,
  CalendarDays,
  ChevronLeft,
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
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  Zap
} from 'lucide-react';
import { membershipPlan } from '../membership/plans';

const menuItems = [
  { icon: Swords, label: 'Play', hasFlyout: true },
  { icon: Users, label: 'Bạn bè', route: 'friends' },
  { icon: Bell, label: 'Thông báo', route: 'notifications', badge: true },
  { icon: BookOpen, label: 'Hướng dẫn người mới', route: 'beginnerGuide' },
  { icon: Trophy, label: 'Giải đấu', route: 'tournaments' },
  { icon: Puzzle, label: 'Puzzles', hasPuzzleFlyout: true },
  { icon: Crown, label: 'Premium', route: 'membership' }
];

const playMenuItems = [
  { icon: Swords, label: 'Chơi online', route: 'online' },
  { icon: Bot, label: 'Chơi với bot', route: 'bot' },
  { icon: Users, label: 'Chơi đối kháng', route: 'local' },
  { icon: MessageSquare, label: 'Play Coach', route: 'coach' },
  { divider: true },
  { icon: Trophy, label: 'Bảng xếp hạng', route: 'leaderboard' },
  { icon: Target, label: 'Thành tựu', route: 'achievements' },
  { icon: Brain, label: 'Coach Lab', route: 'coachLab' },
  { icon: BarChart3, label: 'Profile', route: 'profile' },
  { icon: History, label: 'Lịch sử trận đấu', route: 'history' }
];

const puzzleMenuItems = [
  { icon: Puzzle, label: 'Puzzles', route: 'puzzles' },
  { icon: CalendarDays, label: 'Daily Puzzle', route: 'daily-puzzle' },
  { icon: Zap, label: 'Puzzle Rush', route: 'puzzle-rush' },
  { icon: Target, label: 'Puzzle Streak', route: 'puzzle-streak' },
  { icon: Trophy, label: 'Custom Puzzles', route: 'custom-puzzles' },
  { icon: Brain, label: 'Mistake Lab', route: 'personal-puzzles' }
];

const playRoutes = [
  'online',
  'bot',
  'coach',
  'local',
  'leaderboard',
  'achievements',
  'coachLab',
  'profile',
  'history'
];

const puzzleRoutes = [
  'puzzles',
  'daily-puzzle',
  'puzzle-rush',
  'puzzle-streak',
  'puzzle-battle',
  'custom-puzzles',
  'personal-puzzles'
];

const playModeRoutes = new Set(['online', 'bot', 'coach', 'local']);

export default function Sidebar({
  authUser,
  userName,
  activeRoute,
  membership,
  notificationCount = 0,
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
  const [mobileSubmenu, setMobileSubmenu] = React.useState(null);
  const plan = membershipPlan(membership);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.nav-item.has-flyout')) {
        setOpenFlyout(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (!mobileOpen) {
      setOpenFlyout(null);
      setMobileSubmenu(null);
    }
  }, [mobileOpen]);

  const isMobileView = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900;
  };

  const handleNavigate = (nextRoute) => {
    setOpenFlyout(null);
    setMobileSubmenu(null);
    onNavigate?.(nextRoute);
    onCloseMobile?.();
  };

  const handleToggleFlyout = (label) => {
    setOpenFlyout((current) => (current === label ? null : label));
  };

  const renderMobileSubmenu = () => {
    const isPlaySubmenu = mobileSubmenu === 'play';
    const items = isPlaySubmenu ? playMenuItems : puzzleMenuItems;
    const title = isPlaySubmenu ? 'Play' : 'Puzzles';

    return (
      <div className="mobile-submenu-panel">
        <button
          type="button"
          className="mobile-submenu-back"
          onClick={() => setMobileSubmenu(null)}
        >
          <ChevronLeft size={18} />
          <span>Quay lại</span>
        </button>

        <div className="mobile-submenu-heading">
          <strong>{title}</strong>
          <span>
            {isPlaySubmenu
              ? 'Chọn chế độ chơi của bạn'
              : 'Luyện chiến thuật mỗi ngày'}
          </span>
        </div>

        <div className="mobile-submenu-list">
          {items.map((subItem, index) => {
            if (subItem.divider) {
              return <hr key={`divider-${index}`} />;
            }

            const SubIcon = subItem.icon;

            return (
              <button
                type="button"
                key={subItem.label}
                className="mobile-submenu-item"
                disabled={subItem.disabled}
                onClick={() => {
                  if (subItem.disabled) return;

                  if (isPlaySubmenu && playModeRoutes.has(subItem.route)) {
                    onSelectPlayMode?.(subItem.route);
                  }

                  handleNavigate(subItem.route);
                }}
              >
                <SubIcon size={20} />
                <span>{subItem.label}</span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .nav-item {
          position: relative;
        }

        .nav-item > button {
          width: 100%;
        }

        .nav-chevron {
          margin-left: auto;
          transition: transform 0.18s ease;
        }

        .nav-item.open .nav-chevron {
          transform: rotate(90deg);
        }

        .play-flyout {
          display: none !important;
          position: absolute;
          top: 0;
          left: calc(100% + 10px);
          min-width: 255px;
          z-index: 999;
          flex-direction: column;
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .nav-item.open > .play-flyout {
          display: flex !important;
        }

        .play-flyout hr {
          width: 100%;
          border: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.14);
          margin: 8px 0;
        }

        .play-flyout button {
          width: 100%;
          justify-content: flex-start;
        }

        .mobile-submenu-panel {
          display: none;
        }

        @media (max-width: 900px) {
          .app-sidebar {
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }

          .nav-item.has-flyout.open > .play-flyout {
            display: none !important;
          }

          .mobile-submenu-panel {
            display: flex;
            flex-direction: column;
            gap: 14px;
            width: 100%;
            animation: mobileSubmenuIn 0.18s ease;
          }

          .mobile-submenu-back {
            width: fit-content;
            min-height: 40px;
            padding: 9px 12px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.08);
            color: #f4ffe9;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }

          .mobile-submenu-heading {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 4px 2px 2px;
          }

          .mobile-submenu-heading strong {
            font-size: 24px;
            line-height: 1.1;
            color: #f4ffe9;
          }

          .mobile-submenu-heading span {
            font-size: 13px;
            color: rgba(244, 255, 233, 0.68);
          }

          .mobile-submenu-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .mobile-submenu-list hr {
            width: 100%;
            border: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin: 6px 0;
          }

          .mobile-submenu-item {
            width: 100%;
            min-height: 50px;
            padding: 12px 14px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            background: rgba(255, 255, 255, 0.055);
            color: #f4ffe9;
            border: 1px solid rgba(255, 255, 255, 0.06);
          }

          .mobile-submenu-item span {
            flex: 1;
            text-align: left;
          }

          .mobile-submenu-item svg:last-child {
            opacity: 0.65;
          }

          .mobile-submenu-item:active {
            transform: scale(0.985);
          }

          @keyframes mobileSubmenuIn {
            from {
              opacity: 0;
              transform: translateX(16px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        }
      `}</style>

      <button
        className="mobile-sidebar-toggle"
        onClick={onToggleMobile}
        aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <button
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={() => {
          setOpenFlyout(null);
          setMobileSubmenu(null);
          onCloseMobile?.();
        }}
        aria-label="Đóng menu"
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
          {mobileSubmenu
            ? renderMobileSubmenu()
            : menuItems.map((item) => {
                const Icon = item.icon;

                const isActive = item.hasFlyout
                  ? playRoutes.includes(activeRoute)
                  : item.hasPuzzleFlyout
                    ? puzzleRoutes.includes(activeRoute)
                    : item.route === activeRoute;

                const isOpen = openFlyout === item.label;
                const hasFlyout = item.hasFlyout || item.hasPuzzleFlyout;

                return (
                  <div
                    className={`nav-item ${isActive ? 'active' : ''} ${
                      hasFlyout ? 'has-flyout' : ''
                    } ${isOpen ? 'open' : ''}`}
                    key={item.label}
                    onMouseLeave={() => {
                      if (
                        hasFlyout &&
                        window.matchMedia('(hover: hover)').matches &&
                        window.innerWidth > 900
                      ) {
                        setOpenFlyout(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={isActive ? 'active' : ''}
                      onClick={() => {
                        if (hasFlyout) {
                          if (isMobileView()) {
                            setMobileSubmenu(item.hasFlyout ? 'play' : 'puzzles');
                            setOpenFlyout(null);
                            return;
                          }

                          handleToggleFlyout(item.label);
                          return;
                        }

                        if (item.route) {
                          handleNavigate(item.route);
                        }
                      }}
                      aria-expanded={hasFlyout ? isOpen : undefined}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>

                      {item.badge && notificationCount > 0 && (
                        <b className="nav-badge">
                          {Math.min(notificationCount, 99)}
                        </b>
                      )}

                      {hasFlyout && (
                        <ChevronRight className="nav-chevron" size={17} />
                      )}
                    </button>

                    {item.hasFlyout && (
                      <div className="play-flyout" aria-label="Play menu">
                        {playMenuItems.map((playItem, index) => {
                          if (playItem.divider) {
                            return <hr key={`divider-${index}`} />;
                          }

                          const PlayIcon = playItem.icon;

                          return (
                            <button
                              type="button"
                              key={playItem.label}
                              disabled={playItem.disabled}
                              title={playItem.note}
                              onClick={() => {
                                if (playItem.disabled) return;

                                if (playModeRoutes.has(playItem.route)) {
                                  onSelectPlayMode?.(playItem.route);
                                }

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
                      <div
                        className="play-flyout puzzle-flyout"
                        aria-label="Puzzles menu"
                      >
                        {puzzleMenuItems.map((puzzleItem) => {
                          const PuzzleIcon = puzzleItem.icon;

                          return (
                            <button
                              type="button"
                              key={puzzleItem.route}
                              onClick={() => handleNavigate(puzzleItem.route)}
                            >
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

        {!mobileSubmenu && (
          <>
            <button
              className="sidebar-offer"
              onClick={() => handleNavigate('membership')}
            >
              <Crown size={18} />
              {plan.id === 'free' ? 'Upgrade Premium' : `${plan.badge} active`}
            </button>

            <div className="sidebar-account">
              <div className="sidebar-card">
                {authUser?.photoURL ? (
                  <img className="sidebar-avatar" src={authUser.photoURL} alt="" />
                ) : (
                  <Shield size={22} />
                )}

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

                    <button
                      onClick={() => {
                        setOpenFlyout(null);
                        setMobileSubmenu(null);
                        onLogout?.();
                        onCloseMobile?.();
                      }}
                    >
                      <LogOut size={18} />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setOpenFlyout(null);
                        setMobileSubmenu(null);
                        onLogin?.();
                        onCloseMobile?.();
                      }}
                    >
                      <Lock size={18} />
                      Sign in
                    </button>

                    <button
                      onClick={() => {
                        setOpenFlyout(null);
                        setMobileSubmenu(null);
                        onRegister?.();
                        onCloseMobile?.();
                      }}
                    >
                      Register
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
