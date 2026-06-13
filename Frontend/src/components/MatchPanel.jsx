import React from 'react';
import { Bot, ClipboardList, Flag, Gamepad2, Lightbulb, MessageSquare, Play, RotateCcw, SkipBack, Undo2, Volume2, VolumeX } from 'lucide-react';
import { TIME_CONTROLS } from '../game/constants';
import { statusText } from '../game/chessLogic';
import { BOT_PERSONAS } from '../data/bots';
import { reviewIcon } from '../data/review';
import { COACH_AVATAR, coachDifficultyFromElo, COACH_LEVELS, COACH_MODES } from '../coach/coach';

export default function MatchPanel({
  botGameStarted,
  isCoachGame,
  coachSpeechText,
  coachInsight,
  aiElo,
  aiLevel,
  activeBotPersona,
  botPersonas = BOT_PERSONAS,
  botGroups = [],
  botOptions,
  botChatText,
  coachMode,
  coachLesson,
  coachAudioEnabled,
  timeControlId,
  gameVariant,
  history,
  game,
  reviewMode,
  playerColor,
  userName,
  stockfishStatus,
  engineError,
  isAiThinking,
  gameId,
  sideChoice,
  gameMode,
  usesAiOpponent,
  isPlayerTurn,
  currentReviewAnalysis,
  reviewPly,
  stockfishReview,
  onChangeAiElo,
  onSetCoachMode,
  onToggleCoachAudio,
  onChangeTimeControl,
  onChangeVariant,
  onUpdateBotOption,
  onStartBotMatch,
  onResignGame,
  onShowHintMove,
  onUndoMove,
  onReviewGame,
  onStartNewGame,
  onSetFlipped,
  onSetReviewMode,
  onSetReviewPly,
  onChangeSideChoice,
  onNavigate,
  onSetResultDismissed
}) {
  const hasCoachMoves = isCoachGame && history.length > 0;
  const showSetup = isCoachGame ? !hasCoachMoves : !botGameStarted;

  return (
    <aside className={`match-panel compact-bot-panel ${showSetup ? 'bot-setup' : 'bot-started'}`}>
      {showSetup ? (
        <BotSetup
          isCoachGame={isCoachGame}
          coachSpeechText={coachSpeechText}
          coachInsight={coachInsight}
          aiElo={aiElo}
          aiLevel={aiLevel}
          activeBotPersona={activeBotPersona}
          botPersonas={botPersonas}
          botGroups={botGroups}
          botOptions={botOptions}
          botChatText={botChatText}
          coachMode={coachMode}
          coachLesson={coachLesson}
          coachAudioEnabled={coachAudioEnabled}
          timeControlId={timeControlId}
          gameVariant={gameVariant}
          onChangeAiElo={onChangeAiElo}
          onSetCoachMode={onSetCoachMode}
          onToggleCoachAudio={onToggleCoachAudio}
          onChangeTimeControl={onChangeTimeControl}
          onChangeVariant={onChangeVariant}
          onUpdateBotOption={onUpdateBotOption}
          onStartBotMatch={onStartBotMatch}
        />
      ) : (
        <BotLive
          isCoachGame={isCoachGame}
          coachSpeechText={coachSpeechText}
          coachAudioEnabled={coachAudioEnabled}
          coachInsight={coachInsight}
          activeBotPersona={activeBotPersona}
          botPersonas={botPersonas}
          botGroups={botGroups}
          botOptions={botOptions}
          botChatText={botChatText}
          coachLesson={coachLesson}
          history={history}
          reviewMode={reviewMode}
          reviewPly={reviewPly}
          playerColor={playerColor}
          stockfishReview={stockfishReview}
          game={game}
          isPlayerTurn={isPlayerTurn}
          onResignGame={onResignGame}
          onShowHintMove={onShowHintMove}
          onUndoMove={onUndoMove}
          onReviewGame={onReviewGame}
          onToggleCoachAudio={onToggleCoachAudio}
          onSetReviewMode={onSetReviewMode}
          onSetReviewPly={onSetReviewPly}
          onSetResultDismissed={onSetResultDismissed}
        />
      )}

      <div className="match-heading">
        <p>{reviewMode ? 'Game review' : 'Live game'}</p>
        <h1>{reviewMode ? `${playerColor === 'w' ? userName : `AI ${aiLevel.elo}`} vs ${playerColor === 'b' ? userName : `AI ${aiLevel.elo}`}` : statusText(game)}</h1>
        <span>{reviewMode ? `Stockfish: ${stockfishStatus}` : engineError || (isAiThinking ? `Stockfish ${aiLevel.elo} is thinking...` : `Game ID: ${gameId}`)}</span>
      </div>

      <div className="quick-actions">
        <button onClick={onStartNewGame}>
          <RotateCcw size={18} />
          New game
        </button>
        <button onClick={onUndoMove} disabled={history.length === 0}>
          <SkipBack size={18} />
          Undo
        </button>
        <button onClick={() => onSetFlipped((value) => !value)}>
          <Flag size={18} />
          Flip board
        </button>
        {reviewMode && (
          <button onClick={() => {
            onSetReviewMode(false);
            onSetReviewPly(history.length);
          }}>
            <Gamepad2 size={18} />
            Back
          </button>
        )}
      </div>

      <div className="mode-strip">
        <button className={sideChoice === 'w' ? 'active' : ''} onClick={() => onChangeSideChoice('w')}>White</button>
        <button className={sideChoice === 'b' ? 'active' : ''} onClick={() => onChangeSideChoice('b')}>Black</button>
        <button className={sideChoice === 'random' ? 'active' : ''} onClick={() => onChangeSideChoice('random')}>Random</button>
      </div>

      <div className="mode-strip">
        <button className={gameMode === 'bot' ? 'active' : ''} onClick={() => onNavigate('bot')}>Bot</button>
        <button className={gameMode === 'coach' ? 'active' : ''} onClick={() => onNavigate('coach')}>Coach</button>
        <button className={gameMode === 'local' ? 'active' : ''} onClick={() => onNavigate('local')}>Local 2P</button>
        <button disabled title="Cần realtime server hoặc Supabase Realtime">Online</button>
      </div>

      {!hasCoachMoves && (
        <>
      <ModeLobby
        gameMode={gameMode}
        activeBotPersona={activeBotPersona}
        botPersonas={botPersonas}
        botGroups={botGroups}
        aiElo={aiElo}
        aiLevel={aiLevel}
        coachInsight={coachInsight}
        coachMode={coachMode}
        coachSpeechText={coachSpeechText}
        onChangeAiElo={onChangeAiElo}
        onSetCoachMode={onSetCoachMode}
      />

      <PanelOptions
        timeControlId={timeControlId}
        gameVariant={gameVariant}
        onChangeTimeControl={onChangeTimeControl}
        onChangeVariant={onChangeVariant}
      />

      <div className="ai-summary">
        <Bot size={20} />
        <div>
          <strong>{usesAiOpponent ? `${isCoachGame ? 'Coach' : activeBotPersona.name} đang sẵn sàng` : 'Local 2P đã bật'}</strong>
          <span>{usesAiOpponent ? `${isCoachGame ? coachInsight.mode.depth : activeBotPersona.mood}. ${aiLevel.search}` : 'Hai người chơi cùng một thiết bị.'}</span>
        </div>
      </div>
        </>
      )}

      {reviewMode && (
        <div className="review-panel">
          <span>Review current game</span>
          <strong>
            Move {reviewPly} / {history.length}
          </strong>
          {currentReviewAnalysis && (
            <p className={`move-grade ${currentReviewAnalysis.tone}`}>
              {currentReviewAnalysis.label}: {currentReviewAnalysis.san}
              {currentReviewAnalysis.bestMove ? ` | Best: ${currentReviewAnalysis.bestMove}` : currentReviewAnalysis.bestSan !== currentReviewAnalysis.san ? ` | Best: ${currentReviewAnalysis.bestSan}` : ''}
              {Number.isFinite(currentReviewAnalysis.winLoss) ? ` | Lost: ${currentReviewAnalysis.winLoss}%` : ''}
            </p>
          )}
          <div>
            <button onClick={() => onSetReviewPly((ply) => Math.max(0, ply - 1))} disabled={reviewPly === 0}>Prev</button>
            <button onClick={() => onSetReviewPly((ply) => Math.min(history.length, ply + 1))} disabled={reviewPly === history.length}>Next</button>
            <button onClick={() => onSetReviewPly(history.length)}>End</button>
          </div>
        </div>
      )}

      {(history.length > 0 || reviewMode) && (
        <MoveList
          history={history}
          reviewMode={reviewMode}
          reviewPly={reviewPly}
          stockfishReview={stockfishReview}
          onSetReviewMode={onSetReviewMode}
          onSetResultDismissed={onSetResultDismissed}
          onSetReviewPly={onSetReviewPly}
        />
      )}

      <div className="analysis-card">
        <Gamepad2 size={20} />
        <div>
          <strong>Move review</strong>
          <span>Book/Brilliant/Great/Best labels are calculated by Stockfish.</span>
        </div>
      </div>
    </aside>
  );
}

function BotSetup(props) {
  const {
    isCoachGame,
    coachSpeechText,
    coachInsight,
    aiElo,
    aiLevel,
    activeBotPersona,
    botPersonas,
    botGroups,
    botOptions,
    botChatText,
    coachMode,
    coachLesson,
    coachAudioEnabled,
    timeControlId,
    gameVariant,
    onChangeAiElo,
    onSetCoachMode,
    onToggleCoachAudio,
    onChangeTimeControl,
    onChangeVariant,
    onUpdateBotOption,
    onStartBotMatch
  } = props;

  return (
    <section className={`bot-setup-panel ${isCoachGame ? 'coach-panel' : ''}`} aria-label={isCoachGame ? 'Huấn luyện viên chiến thuật' : 'Choose bot'}>
      <div className="bot-lobby-title">
        {isCoachGame ? <MessageSquare size={19} /> : <Bot size={19} />}
        <strong>{isCoachGame ? 'Huấn luyện viên chiến thuật' : 'Play Bots'}</strong>
        {isCoachGame && (
          <button
            className="coach-audio-toggle"
            type="button"
            onClick={onToggleCoachAudio}
            title={coachAudioEnabled ? 'Tắt giọng coach' : 'Bật giọng coach'}
            aria-pressed={coachAudioEnabled}
            aria-label={coachAudioEnabled ? 'Tắt giọng coach' : 'Bật giọng coach'}
          >
            {coachAudioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        )}
      </div>
      {isCoachGame ? (
        <div className="coach-setup-stack">
          <div className="coach-dialog">
            <img src={COACH_AVATAR} alt="Huấn luyện viên" />
            <div>
              <p>{coachSpeechText}</p>
            </div>
          </div>
          <button className="bot-play-button coach-start-button" onClick={onStartBotMatch}>
            <Play size={20} />
            Bắt đầu luyện
          </button>
          <div className="coach-level-list">
            <button className="coach-level-current" type="button">
              <span>{coachDifficultyFromElo(Number(aiElo))} ({aiLevel.elo})</span>
              <span>^</span>
            </button>
            {COACH_LEVELS.map((level) => (
              <button
                className={Number(aiElo) === level.elo ? 'active' : ''}
                key={level.elo}
                type="button"
                onClick={() => onChangeAiElo(level.elo)}
              >
                <strong>{level.label}</strong>
                <span>({level.elo})</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="bot-chat-card">
            <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
            <div>
              {botOptions.botChat && <p>{botChatText}</p>}
              <strong>{activeBotPersona.name} <span>{aiLevel.elo}</span></strong>
            </div>
          </div>
          <BotFamily aiElo={aiElo} activeBotPersona={activeBotPersona} botPersonas={botPersonas} botGroups={botGroups} onChangeAiElo={onChangeAiElo} />
        </>
      )}
      {isCoachGame ? (
        <div className="coach-mode-card">
          <strong>Chọn bài học huấn luyện</strong>
          <div>
            {COACH_MODES.map((mode) => (
              <button
                className={coachMode === mode.id ? 'active' : ''}
                key={mode.id}
                type="button"
                onClick={() => onSetCoachMode(mode.id)}
                title={mode.depth}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <small>{coachLesson?.title ? `${coachLesson.title}: ${coachLesson.goal}` : coachInsight.mode.depth}</small>
        </div>
      ) : null}
      <details className="bot-options compact-options">
        <summary>Options</summary>
        <PanelOptions timeControlId={timeControlId} gameVariant={gameVariant} onChangeTimeControl={onChangeTimeControl} onChangeVariant={onChangeVariant} />
        <div className="bot-toggle-list">
          {[
            ['Bot Chat', 'botChat'],
            ['Evaluation Bar', 'evaluationBar'],
            ['Threat Arrows', 'threatArrows'],
            ['Suggestion Arrows', 'suggestionArrows'],
            ['Move Feedback', 'moveFeedback']
          ].map(([item, key]) => (
            <label key={key}>
              <span>{item}</span>
              <input type="checkbox" checked={botOptions[key]} onChange={() => onUpdateBotOption(key)} />
            </label>
          ))}
        </div>
      </details>
      {!isCoachGame && (
        <button className="bot-play-button" onClick={onStartBotMatch}>
          <Play size={20} />
          Play
        </button>
      )}
    </section>
  );
}

function BotLive({ isCoachGame, coachSpeechText, coachAudioEnabled, coachInsight, activeBotPersona, botOptions, botChatText, coachLesson, history, reviewMode, reviewPly, playerColor, stockfishReview, game, isPlayerTurn, onResignGame, onShowHintMove, onUndoMove, onReviewGame, onToggleCoachAudio, onSetReviewMode, onSetReviewPly, onSetResultDismissed }) {
  const inspectMove = (ply) => {
    onSetReviewMode(true);
    onSetResultDismissed(true);
    onSetReviewPly(ply);
  };

  return (
    <section className={`bot-live-panel ${isCoachGame ? 'coach-panel' : ''}`} aria-label={isCoachGame ? 'Huấn luyện viên đang hướng dẫn' : 'Live bot game'}>
      <div className="bot-lobby-title">
        {isCoachGame ? <MessageSquare size={19} /> : <Bot size={19} />}
        <strong>{isCoachGame ? 'Huấn luyện viên chiến thuật' : 'Play Bots'}</strong>
        {isCoachGame && (
          <button
            className="coach-audio-toggle"
            type="button"
            onClick={onToggleCoachAudio}
            title={coachAudioEnabled ? 'Tắt giọng coach' : 'Bật giọng coach'}
            aria-pressed={coachAudioEnabled}
            aria-label={coachAudioEnabled ? 'Tắt giọng coach' : 'Bật giọng coach'}
          >
            {coachAudioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        )}
      </div>
      {isCoachGame ? (
        <>
          <div className="coach-dialog">
            <img src={COACH_AVATAR} alt="Huấn luyện viên" />
            <div>
              <p>{coachSpeechText}</p>
            </div>
          </div>
          <div className={`live-coach-card compact ${coachInsight.tone}`}>
            <div className="live-coach-head">
              <span className={`move-badge inline ${coachInsight.tone}`}>
                {reviewIcon(coachInsight.tone)}
              </span>
              <strong>{coachInsight.quality}</strong>
              <b>{coachInsight.evaluation || coachInsight.difficulty}</b>
            </div>
            <div className="live-coach-meta">
              <span>{coachInsight.difficulty}</span>
              <span>{history.length ? `Nước ${history.length}` : 'Khai cuộc'}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="bot-chat-card live">
          <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
          <div>
            {botOptions.botChat && <p>{botChatText}</p>}
          </div>
        </div>
      )}
      <div className="opening-row">
        <span>{isCoachGame && coachLesson?.title ? coachLesson.title : history.length ? 'Biên bản' : 'Sẵn sàng'}</span>
        <strong>{statusText(game)}</strong>
        {isCoachGame && coachLesson?.goal ? <small>{coachLesson.goal}</small> : null}
      </div>
      <div className="compact-move-list">
        {Array.from({ length: Math.max(1, Math.ceil(history.length / 2)) }).map((_, index) => (
          <div className="compact-move-row" key={index}>
            <span>{index + 1}.</span>
            <button
              className={reviewMode && reviewPly === index * 2 + 1 ? 'active' : ''}
              type="button"
              disabled={!history[index * 2]}
              onClick={() => inspectMove(index * 2 + 1)}
            >
              {history[index * 2]?.san ?? ''}
              {isCoachGame && history[index * 2]?.color === playerColor && (
                <i className={`move-grade-icon ${stockfishReview[index * 2]?.tone ?? 'loading'}`}>
                  {reviewIcon(stockfishReview[index * 2]?.tone ?? 'loading')}
                </i>
              )}
            </button>
            <button
              className={reviewMode && reviewPly === index * 2 + 2 ? 'active' : ''}
              type="button"
              disabled={!history[index * 2 + 1]}
              onClick={() => inspectMove(index * 2 + 2)}
            >
              {history[index * 2 + 1]?.san ?? ''}
              {isCoachGame && history[index * 2 + 1]?.color === playerColor && (
                <i className={`move-grade-icon ${stockfishReview[index * 2 + 1]?.tone ?? 'loading'}`}>
                  {reviewIcon(stockfishReview[index * 2 + 1]?.tone ?? 'loading')}
                </i>
              )}
            </button>
          </div>
        ))}
      </div>
      <div className={`bot-live-actions ${isCoachGame ? 'with-review' : ''}`}>
        <button onClick={onResignGame} title="Đầu hàng"><Flag size={20} /></button>
        <button onClick={onShowHintMove} disabled={!isPlayerTurn || game.isGameOver()} title="Hint"><Lightbulb size={20} /></button>
        <button onClick={onUndoMove} disabled={history.length === 0} title="Undo"><Undo2 size={20} /></button>
        {isCoachGame && (
          <button onClick={onReviewGame} disabled={history.length === 0} title="Review toàn ván">
            <ClipboardList size={20} />
          </button>
        )}
      </div>
    </section>
  );
}

function ModeLobby({ gameMode, activeBotPersona, botPersonas = BOT_PERSONAS, botGroups = [], aiElo, aiLevel, coachInsight, coachMode, coachSpeechText, onChangeAiElo, onSetCoachMode }) {
  if (gameMode === 'bot') {
    return (
      <section className="bot-lobby" aria-label="Play Bots">
        <div className="bot-lobby-title">
          <Bot size={19} />
          <strong>Play Bots</strong>
        </div>
        <div className="bot-chat-card">
          <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
          <div>
            <p>{activeBotPersona.chat}</p>
            <strong>{activeBotPersona.name} <span>{aiLevel.elo}</span></strong>
          </div>
        </div>
        <BotFamily aiElo={aiElo} activeBotPersona={activeBotPersona} botPersonas={botPersonas} botGroups={botGroups} onChangeAiElo={onChangeAiElo} />
      </section>
    );
  }

  if (gameMode === 'coach') {
    return (
      <section className="bot-lobby coach-lobby" aria-label="Huấn luyện viên chiến thuật">
        <div className="bot-lobby-title">
          <MessageSquare size={19} />
          <strong>Huấn luyện viên chiến thuật</strong>
        </div>
        <div className={`live-coach-card ${coachInsight.tone}`}>
          <div className="live-coach-head">
            <span>{coachInsight.mode.focus}</span>
            <strong>{coachInsight.quality}</strong>
            <b>{coachInsight.difficulty}</b>
          </div>
          <p>{coachSpeechText}</p>
          {coachInsight.warning && <em>{coachInsight.warning}</em>}
          <small>{coachInsight.plan}</small>
        </div>
        <div className="coach-mode-card">
          <strong>Bài học coach</strong>
          <div>
            {COACH_MODES.map((mode) => (
              <button
                className={coachMode === mode.id ? 'active' : ''}
                key={mode.id}
                type="button"
                onClick={() => onSetCoachMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return null;
}

function PanelOptions({ timeControlId, gameVariant, onChangeTimeControl, onChangeVariant }) {
  return (
    <>
      <div className="time-control-grid">
        {TIME_CONTROLS.map((control) => (
          <button
            className={timeControlId === control.id ? 'active' : ''}
            key={control.id}
            type="button"
            onClick={() => onChangeTimeControl(control.id)}
          >
            {control.label.replace('Rapid ', '').replace('Blitz ', '').replace('Bullet ', '')}
          </button>
        ))}
      </div>
      <div className="variant-card">
        <button className={gameVariant === 'standard' ? 'active' : ''} type="button" onClick={() => onChangeVariant('standard')}>
          <strong>Standard</strong>
          <span>Kiểu chơi bình thường</span>
        </button>
        <button className={gameVariant === 'chess960' ? 'active' : ''} type="button" onClick={() => onChangeVariant('chess960')}>
          <strong>Chess960</strong>
          <span>Hàng quân sau ngẫu nhiên</span>
        </button>
      </div>
    </>
  );
}

function BotFamily({ aiElo, activeBotPersona, botPersonas = BOT_PERSONAS, botGroups = [], onChangeAiElo }) {
  const groups = botGroups.length ? botGroups : [{ id: 'stockfish', label: 'Stockfish roster', bots: botPersonas }];
  return (
    <div className="bot-family-card">
      <div>
        <strong>Bot roster</strong>
        <span>{groups.length} groups | {botPersonas.length} bots</span>
      </div>
      <div className="bot-group-list">
        {groups.map((group) => (
          <div className="bot-roster-group" key={group.id}>
            <div>
              <strong>{group.label}</strong>
              <span>{group.bots.length} bots</span>
            </div>
            <div className="bot-avatar-row">
              {group.bots.map((bot) => (
                <button
                  className={Number(aiElo) === bot.elo && activeBotKey(bot) === activeBotKey(activeBotPersona) ? 'active' : ''}
                  key={`${bot.name}-${bot.elo}-${bot.id || ''}`}
                  onClick={() => onChangeAiElo(bot.elo, bot.id || '')}
                  title={`${bot.name} - ELO ${bot.elo}`}
                  type="button"
                >
                  <img src={bot.avatar} alt={bot.name} />
                  <span>{bot.elo}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function activeBotKey(bot) {
  return bot?.id || `${bot?.name || 'bot'}-${bot?.elo || 0}`;
}

function MoveList({ history, reviewMode, reviewPly, stockfishReview, onSetReviewMode, onSetResultDismissed, onSetReviewPly }) {
  return (
    <div className="move-list">
      <div className="move-list-head">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>
      <div className="move-list-body">
        {history.length === 0 && <p className="empty-state">Make the first move.</p>}
        {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
          <div className="move-row" key={index}>
            <span>{index + 1}</span>
            <button
              className={`${reviewMode && reviewPly === index * 2 + 1 ? 'active' : ''} ${stockfishReview[index * 2]?.tone ?? ''}`}
              disabled={!history[index * 2]}
              onClick={() => {
                onSetReviewMode(true);
                onSetResultDismissed(true);
                onSetReviewPly(index * 2 + 1);
              }}
            >
              {history[index * 2]?.san ?? ''}
            </button>
            <button
              className={`${reviewMode && reviewPly === index * 2 + 2 ? 'active' : ''} ${stockfishReview[index * 2 + 1]?.tone ?? ''}`}
              disabled={!history[index * 2 + 1]}
              onClick={() => {
                onSetReviewMode(true);
                onSetResultDismissed(true);
                onSetReviewPly(index * 2 + 2);
              }}
            >
              {history[index * 2 + 1]?.san ?? ''}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
