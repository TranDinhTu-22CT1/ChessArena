import React from 'react';
import { Bot, Flame, GraduationCap, Puzzle, Shield, Star, Swords, Timer, Users } from 'lucide-react';
import { HOME_IMAGES } from '../data/homeImages';
import { TIME_CONTROLS } from '../game/constants';

export default function HomePage({
  userName,
  history,
  reviewStats,
  timeControl,
  onStartNewGame,
  onNavigate,
  onReviewGame
}) {
  return (
    <section className="home-dashboard">
      <div className="home-player">
        <div className="home-avatar">
          <Shield size={22} />
        </div>
        <div>
          <span>Chào mừng trở lại</span>
          <strong>{userName}</strong>
        </div>
      </div>

      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="hero-kicker">Chess Arena Studio</span>
          <h1>Chào mừng, {userName}</h1>
          <p>Vào trận nhanh, luyện chiến thuật và xem lại ván đấu trong một không gian tập trung, hiện đại và dành riêng cho bạn.</p>
          <div className="home-hero-actions">
            <button onClick={() => {
              onStartNewGame();
              onNavigate('bot');
            }}>Chơi ngay</button>
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
          <span>Streak</span>
          <strong>1 Day Streak</strong>
        </div>
        <div>
          <Puzzle size={42} />
          <span>Puzzles</span>
          <strong>{reviewStats.totals.w + reviewStats.totals.b}</strong>
        </div>
        <div>
          <GraduationCap size={46} />
          <span>Next Lesson</span>
          <strong>Learn To Play: The King</strong>
        </div>
        <div>
          <Star size={44} />
          <span>Game Review</span>
          <strong>Learn from your mistakes</strong>
        </div>
      </section>

      <section className="home-grid">
        <div className="home-actions">
          <button onClick={() => {
            onStartNewGame({ nextTimeControl: TIME_CONTROLS.find((control) => control.id === '600+0') ?? timeControl });
            onNavigate('bot');
          }}>
            <Timer size={25} />
            Play 10 min
          </button>
          <button onClick={() => {
            onStartNewGame();
            onNavigate('online');
          }}>
            <Swords size={25} />
            Play Online
          </button>
          <button onClick={() => onNavigate('bot')}>
            <Bot size={25} />
            Play Bots
          </button>
          <button onClick={() => onNavigate('local')}>
            <Users size={25} />
            Play a Friend
          </button>
        </div>

        {[
          { title: 'Solve Puzzle', tone: 'puzzle', image: HOME_IMAGES.puzzle },
          { title: 'Start Lesson', tone: 'lesson', image: HOME_IMAGES.lesson },
          { title: history.length ? 'Review Last Game' : 'Start Review', tone: 'review', image: HOME_IMAGES.review }
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
          </button>
        ))}
      </section>

      <p className="home-image-credit">Hình minh họa bàn cờ online được dựng riêng cho Chess Arena.</p>
    </section>
  );
}
