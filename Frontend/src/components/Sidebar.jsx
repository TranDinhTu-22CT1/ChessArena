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
import Modal from './Modal';
import './sidebar.css';

const menuItems = [
  { icon: Swords, label: 'Play', hasFlyout: true },
  { icon: Users, label: 'Bạn bè', route: 'friends' },
  { icon: Bell, label: 'Thông báo', route: 'notifications', badge: true },
  { icon: MessageSquare, label: 'Hỗ trợ', route: 'support' },
  { icon: MessageSquare, label: 'Ticket & Báo cáo', route: 'supportTickets' },
  { icon: BookOpen, label: 'Hướng dẫn người mới', route: 'beginnerGuide' },
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
  siteTitle = 'Chess Arena',
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
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 980px)').matches);
  const closeMobileRef = React.useRef(onCloseMobile);
  closeMobileRef.current = onCloseMobile;
  const plan = membershipPlan(membership);
  const NavigationContainer = isMobile ? Modal : React.Fragment;
  const containerProps = isMobile ? {
    open: mobileOpen, onClose: onCloseMobile, className: 'mobile-navigation-dialog', 'aria-label': 'Điều hướng chính'
  } : {};

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 980px)');
    const updateViewport = () => {
      setIsMobile(query.matches);
      setOpenFlyout(null);
      setMobileSubmenu(null);
      closeMobileRef.current?.();
    };
    query.addEventListener('change', updateViewport);
    return () => query.removeEventListener('change', updateViewport);
  }, []);

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


      <button
        className="mobile-sidebar-toggle"
        onClick={onToggleMobile}
        aria-label="Mở menu"
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
      >
        <Menu size={22} />
      </button>

      <NavigationContainer {...containerProps}>
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        {isMobile && <button className="mobile-sidebar-close" aria-label="Đóng menu" onClick={onCloseMobile} type="button"><X size={22} /></button>}
        <button className="logo-lockup" onClick={() => handleNavigate('home')}>
          <BrandMark className="logo-mark-image" />
          <div>
            <strong>{siteTitle}</strong>
            <span>Local beta</span>
          </div>
        </button>

        <nav className="main-nav" aria-label="Điều hướng chính" onKeyDown={(event) => {
          if (event.key === 'Escape' && openFlyout && !isMobile) {
            event.stopPropagation();
            setOpenFlyout(null);
            event.target.closest('.nav-item')?.querySelector('button')?.focus();
          }
        }}>
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
                    onMouseLeave={(event) => {
                      if (
                        hasFlyout &&
                        window.matchMedia('(hover: hover)').matches &&
                        !isMobile &&
                        !event.currentTarget.contains(document.activeElement)
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
                          if (isMobile) {
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
                      aria-current={!hasFlyout && isActive ? 'page' : undefined}
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
              {plan.id === 'free' ? 'Nâng cấp Premium' : `${plan.badge} đang sử dụng`}
            </button>

            <div className="sidebar-account">
              <div className="sidebar-card">
                {authUser?.photoURL ? (
                  <img className="sidebar-avatar" src={authUser.photoURL} alt="" />
                ) : (
                  <Shield size={22} />
                )}

                <div>
                  <strong>{authUser ? userName : 'Khách'}</strong>
                  <span>{authUser ? 'Đã đăng nhập' : 'Chưa đăng nhập'}</span>
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
                      Đăng xuất
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
                      Đăng nhập
                    </button>

                    <button
                      onClick={() => {
                        setOpenFlyout(null);
                        setMobileSubmenu(null);
                        onRegister?.();
                        onCloseMobile?.();
                      }}
                    >
                      Đăng ký
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
      </NavigationContainer>
    </>
  );
}
