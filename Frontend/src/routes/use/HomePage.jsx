import React from 'react';
import { ArrowRight, Bot, Flame, GraduationCap, Puzzle, Sparkles, Star, Swords, Timer, Users } from 'lucide-react';
import { fetchAchievements } from '../../api/achievements';
import { fetchProfile } from '../../api/profile';
import { fetchPuzzleProgress } from '../../api/puzzles';
import { HOME_IMAGES } from '../../data/homeImages';
import { TIME_CONTROLS } from '../../game/constants';

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default function HomePage({
  userName,
  authUser,
  history,
  timeControl,
  onStartNewGame,
  onNavigate,
  onReviewGame
}) {
  const lastGameLabel = history.length ? 'Xem lại ván gần nhất' : 'Bắt đầu review';
  const [homeData, setHomeData] = React.useState({
    profile: null,
    puzzleProgress: null,
    achievements: []
  });

  React.useEffect(() => {
    let cancelled = false;

    if (!authUser) {
      setHomeData({
        profile: null,
        puzzleProgress: null,
        achievements: []
      });
      return () => {
        cancelled = true;
      };
    }

    Promise.allSettled([
      fetchProfile(),
      fetchPuzzleProgress(),
      fetchAchievements()
    ]).then(([profileResult, puzzleResult, achievementResult]) => {
      if (cancelled) return;
      setHomeData({
        profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
        puzzleProgress: puzzleResult.status === 'fulfilled' ? puzzleResult.value?.progress : null,
        achievements: achievementResult.status === 'fulfilled' ? achievementResult.value?.achievements || [] : []
      });
    });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const puzzleCorrect = safeNumber(homeData.puzzleProgress?.correct);
  const puzzleAttempted = safeNumber(homeData.puzzleProgress?.attempted);
  const puzzleStreak = safeNumber(homeData.puzzleProgress?.dailyStreak);
  const personalPuzzleCount = safeNumber(homeData.profile?.training?.personalPuzzles);
  const newPersonalPuzzleCount = safeNumber(homeData.profile?.training?.newPersonalPuzzles);
  const unlockedAchievements = homeData.achievements.filter((item) => item.unlocked).length;
  const totalAchievements = homeData.achievements.length;

  return (
    <section className="home-dashboard">
      <section className="home-hero">
        <span className="home-hero-glow home-hero-glow-one" aria-hidden="true" />
        <span className="home-hero-glow home-hero-glow-two" aria-hidden="true" />
        <div className="home-hero-rail" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="home-hero-copy">
          <span className="hero-kicker"><Sparkles size={15} /> Chess Arena Studio</span>
          <h1>Chào mừng trở lại, {userName}</h1>
          <p>Chọn ván đấu, luyện kỹ năng và xem lại sai lầm trong một không gian gọn gàng hơn, rõ nét hơn và sẵn sàng cho buổi chơi hôm nay.</p>
          <div className="home-hero-actions">
            <button onClick={() => {
              onStartNewGame();
              onNavigate('bot');
            }}>Chơi ngay <ArrowRight size={18} /></button>
            <button onClick={() => {
              onStartNewGame({ nextBotGameStarted: false });
              onNavigate('coach');
            }}>Luyện với coach</button>
          </div>
        </div>
        <div className="home-hero-board">
          <img src={HOME_IMAGES.hero} alt="Bàn cờ vua đang sẵn sàng cho ván mới" loading="eager" />
          <span>Rapid 10+0</span>
        </div>
      </section>

      <section className="home-summary">
        <div>
          <Flame size={44} />
          <span>Chuỗi daily puzzle</span>
          <strong>{puzzleStreak} ngày</strong>
        </div>
        <div>
          <Puzzle size={42} />
          <span>Câu đố đã giải</span>
          <strong>{puzzleCorrect}/{puzzleAttempted}</strong>
        </div>
        <div>
          <GraduationCap size={46} />
          <span>Puzzle cá nhân</span>
          <strong>{newPersonalPuzzleCount}/{personalPuzzleCount}</strong>
        </div>
        <div>
          <Star size={44} />
          <span>Thành tựu</span>
          <strong>{unlockedAchievements}/{totalAchievements}</strong>
        </div>
      </section>

      <section className="home-grid">
        <div className="home-actions">
          <button onClick={() => {
            onStartNewGame({ nextTimeControl: TIME_CONTROLS.find((control) => control.id === '600+0') ?? timeControl });
            onNavigate('bot');
          }}>
            <Timer size={25} />
            Chơi 10 phút
          </button>
          <button onClick={() => {
            onStartNewGame();
            onNavigate('online');
          }}>
            <Swords size={25} />
            Chơi online
          </button>
          <button onClick={() => onNavigate('bot')}>
            <Bot size={25} />
            Chơi với bot
          </button>
          <button onClick={() => onNavigate('local')}>
            <Users size={25} />
            Chơi 2 người
          </button>
        </div>

        {[
          { title: 'Giải puzzle', copy: 'Rèn nước đi sắc bén', tone: 'puzzle', image: HOME_IMAGES.puzzle },
          { title: 'Vào bài học', copy: 'Luyện theo lộ trình', tone: 'lesson', image: HOME_IMAGES.lesson },
          { title: lastGameLabel, copy: 'Phân tích và sửa lỗi', tone: 'review', image: HOME_IMAGES.review }
        ].map((card) => (
          <button
            className="home-feature-card"
            key={card.title}
            onClick={() => {
              if (card.tone === 'review' && history.length) {
                onReviewGame();
              } else if (card.tone === 'puzzle') {
                onNavigate('puzzles');
              } else {
                onNavigate('bot');
              }
            }}
          >
            <div className={`home-mini-board ${card.tone}`}>
              <img src={card.image} alt={card.title} loading="lazy" />
            </div>
            <span>{card.title}</span>
            <small>{card.copy}</small>
          </button>
        ))}
      </section>

      <p className="home-image-credit">Hình minh họa bàn cờ online được dựng riêng cho Chess Arena.</p>
    </section>
  );
}
