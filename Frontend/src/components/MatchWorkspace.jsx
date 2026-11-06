import React from 'react';
import { Bot, BookOpen, ChevronLeft, ChevronRight, Flag, Lightbulb, Play, RotateCcw, RefreshCw, Undo2, Volume2, VolumeX } from 'lucide-react';
import { TIME_CONTROLS } from '../game/constants';
import { statusText } from '../game/chessLogic';
import { moveRows } from '../game/moveRows';
import { reviewIcon, reviewLabel } from '../data/review';
import { COACH_AVATAR, COACH_LEVELS, COACH_MODES } from '../coach/coach';

export default function MatchWorkspace({
  botGameStarted, isCoachGame, coachSpeechText, coachInsight, aiElo, aiLevel, activeBotPersona,
  botPersonas = [], botGroups = [], botOptions, botChatText, coachMode, coachLesson,
  coachAudioEnabled, coachVoiceAvailable, timeControlId, gameVariant, history, initialFen,
  game, gameFinished, reviewMode, stockfishStatus, engineError, isAiThinking, hintBusy,
  sideChoice, isPlayerTurn, currentReviewAnalysis, reviewPly, stockfishReview,
  onChangeAiElo, onSetCoachMode, onToggleCoachAudio, onReplayCoachAudio, onRetryReview, onRetryAi,
  onChangeTimeControl, onChangeVariant, onUpdateBotOption, onStartBotMatch, onResignGame,
  onShowHintMove, onUndoMove, onReviewGame, onStartNewGame, onSetFlipped,
  onSetReviewMode, onSetReviewPly, onChangeSideChoice, onSetResultDismissed
}) {
  const showSetup = !botGameStarted && !reviewMode;
  const [confirmAction, setConfirmAction] = React.useState('');
  const rows = moveRows(history, initialFen);
  const groups = botGroups.length ? botGroups : [{ id: 'all', label: 'Chọn đối thủ', bots: botPersonas }];
  const analysisFailed = !['idle', 'loading', 'ready'].includes(stockfishStatus);
  const inspectMove = (ply) => { onSetReviewMode(true); onSetResultDismissed(true); onSetReviewPly(ply); };
  const returnToGame = () => { onSetReviewMode(false); onSetReviewPly(history.length); };
  const askNewGame = () => {
    if (botGameStarted && history.length && !gameFinished) setConfirmAction('new');
    else onStartNewGame();
  };
  return (
    <aside className={`match-panel play-panel ${isCoachGame ? 'play-panel-coach' : 'play-panel-bot'}`} aria-label={isCoachGame ? 'Bảng huấn luyện' : 'Bảng điều khiển bot'}>
      <header className="play-panel-heading">
        <span className="play-panel-symbol">{isCoachGame ? <BookOpen size={22} /> : <Bot size={22} />}</span>
        <div><small>{showSetup ? 'THIẾT LẬP VÁN ĐẤU' : reviewMode ? 'XEM LẠI NƯỚC CỜ' : 'VÁN ĐẤU CỦA BẠN'}</small><h2>{isCoachGame ? 'Huấn luyện viên' : activeBotPersona.name}</h2></div>
        <span className="play-elo">{aiLevel.elo}<small>ELO</small></span>
      </header>
      {isCoachGame ? <section className="play-coach-note" aria-label="Lời hướng dẫn">
        <div className="play-coach-identity"><img src={COACH_AVATAR} alt="" /><strong>Cùng học, từng nước một</strong><button type="button" onClick={onToggleCoachAudio} aria-pressed={coachAudioEnabled} aria-label={coachAudioEnabled ? 'Tắt giọng coach' : 'Bật giọng coach'}>{coachAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></div>
        <p aria-live="polite">{coachSpeechText}</p>
        {!showSetup && <div className="play-coach-assessment"><span className={`play-grade ${coachInsight.tone}`}>{reviewIcon(coachInsight.tone)} {coachInsight.quality}</span>{coachInsight.evaluation && <span title="Đánh giá theo phía Trắng; 1 điểm tương đương một tốt">Trắng: {coachInsight.evaluation}</span>}</div>}
        {coachAudioEnabled && !coachVoiceAvailable && <small className="play-voice-note">Thiết bị chưa có giọng đọc tiếng Việt. Bạn vẫn có thể đọc đầy đủ hướng dẫn tại đây.</small>}
        {coachVoiceAvailable && coachAudioEnabled && <button className="play-text-button" type="button" onClick={onReplayCoachAudio}><Volume2 size={14} /> Đọc lại hướng dẫn</button>}
      </section> : <section className="play-opponent"><img src={activeBotPersona.avatar} alt="" /><div><strong>{activeBotPersona.name}</strong><p>{botOptions.botChat ? botChatText : 'Chọn mức độ phù hợp và thử sức qua từng ván cờ.'}</p></div></section>}
      {showSetup ? <div className="play-setup">
        {isCoachGame ? <>
          <fieldset><legend>01 · Chọn nội dung luyện tập</legend><div className="play-lesson-options">{COACH_MODES.map((mode) => <button type="button" key={mode.id} aria-pressed={coachMode === mode.id} onClick={() => onSetCoachMode(mode.id)}><strong>{mode.label}</strong><small>{mode.focus}</small></button>)}</div></fieldset>
          <div className="play-lesson-goal"><BookOpen size={17} /><div><strong>{coachLesson?.title}</strong><p>{coachLesson?.goal}</p></div></div>
          <label className="play-field">02 · Sức mạnh đối thủ<select value={aiElo} onChange={(event) => onChangeAiElo(Number(event.target.value))}>{COACH_LEVELS.map((level) => <option key={level.elo} value={level.elo}>{level.label} · {level.elo} ELO</option>)}</select></label>
        </> : <div className="play-roster">{groups.map((group) => <details key={group.id} open={groups.length === 1 || group.bots.some((bot) => bot.id ? bot.id === activeBotPersona.id : bot.name === activeBotPersona.name)}><summary>{group.label}<small>{group.bots.length} bot</small></summary><div>{group.bots.map((bot) => <button type="button" key={`${bot.id || bot.name}-${bot.elo}`} aria-pressed={Number(aiElo) === bot.elo && bot.name === activeBotPersona.name} title={`${bot.name} · ${bot.elo} ELO`} onClick={() => onChangeAiElo(bot.elo, bot.id || '')}><img src={bot.avatar} alt="" /><strong>{bot.name}</strong><small>{bot.elo}</small></button>)}</div></details>)}</div>}
        <label className="play-field">{isCoachGame ? '03 · Thời gian mỗi bên' : 'Thời gian mỗi bên'}<select value={timeControlId} onChange={(event) => onChangeTimeControl(event.target.value)}>{TIME_CONTROLS.map((control) => <option value={control.id} key={control.id}>{control.label}</option>)}</select></label>
        {!isCoachGame && <fieldset><legend>Quân của bạn</legend><div className="play-segments">{[['w', 'Trắng'], ['b', 'Đen'], ['random', 'Ngẫu nhiên']].map(([value, label]) => <button type="button" key={value} aria-pressed={sideChoice === value} onClick={() => onChangeSideChoice(value)}>{label}</button>)}</div></fieldset>}
        <details className="play-options"><summary>Tùy chỉnh bàn cờ</summary>
          {!isCoachGame && <label className="play-field">Kiểu chơi<select value={gameVariant} onChange={(event) => onChangeVariant(event.target.value)}><option value="standard">Cờ tiêu chuẩn</option><option value="chess960">Chess960 (chưa hỗ trợ nhập thành)</option></select></label>}
          {[[isCoachGame ? null : 'Lời thoại của bot', 'botChat'], ['Thanh đánh giá', 'evaluationBar'], ['Mũi tên đe dọa', 'threatArrows'], ['Mũi tên gợi ý', 'suggestionArrows'], ['Nhận xét nước đi', 'moveFeedback']].filter(([label]) => label).map(([label, key]) => <label className="play-toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(botOptions[key])} onChange={() => onUpdateBotOption(key)} /></label>)}
        </details>
        <button className="play-primary bot-play-button" type="button" onClick={onStartBotMatch}><Play size={18} />{isCoachGame ? 'Bắt đầu luyện' : 'Bắt đầu ván đấu'}</button>
      </div> : <>
        <div className="play-turn" role="status"><span className={isAiThinking ? 'thinking' : ''} />{gameFinished ? 'Ván đấu đã kết thúc' : reviewMode ? `Đang xem nước ${reviewPly} / ${history.length}` : isAiThinking ? 'Đối thủ đang suy nghĩ…' : statusText(game)}</div>
        {isCoachGame && <div className="play-lesson-goal"><BookOpen size={17} /><div><strong>{coachLesson?.title}</strong><p>{coachLesson?.goal}</p></div></div>}
        {engineError && <div className="play-error" role="alert"><p>{engineError}</p>{!isPlayerTurn && !gameFinished && <button type="button" disabled={isAiThinking} onClick={onRetryAi}>Thử lại nước của đối thủ</button>}</div>}
        {analysisFailed && <div className="play-error" role="alert"><span>Chưa nhận được phân tích. Các nước đi của bạn vẫn được giữ.</span><button type="button" onClick={onRetryReview}>Thử phân tích lại</button></div>}
        <section className="play-score-sheet" aria-label="Biên bản nước cờ"><header><strong>Biên bản</strong><small>{history.length} nước đã đi</small></header><div className="play-move-columns"><span>#</span><span>Trắng</span><span>Đen</span></div><div className="play-moves">{!rows.length && <p>Hãy đi nước đầu tiên trên bàn cờ.</p>}{rows.map((row) => <div className="play-move-row" key={row.number}><span>{row.number}.</span>{['w', 'b'].map((color) => { const move = row[color]; const grade = move && stockfishReview[move.ply - 1]; return <button key={color} type="button" disabled={!move} aria-current={reviewMode && reviewPly === move?.ply ? 'step' : undefined} onClick={() => inspectMove(move.ply)} title={grade ? reviewLabel(grade.tone) : undefined}>{move?.san || '—'}{grade && <small className={`play-grade ${grade.tone}`}>{reviewIcon(grade.tone)}</small>}</button>; })}</div>)}</div></section>
        {!isCoachGame && botOptions.moveFeedback && history.length>0 && <div className="play-last-move-grade" role="status"><small>Nước vừa đi của bạn</small><strong className={`play-grade ${coachInsight.tone}`}>{reviewIcon(coachInsight.tone)} {coachInsight.quality}</strong><span>{coachInsight.warning}</span></div>}
        {reviewMode && <section className="play-review-navigation"><div>{currentReviewAnalysis ? <p><strong>{reviewLabel(currentReviewAnalysis.tone)}</strong> · {currentReviewAnalysis.san}{currentReviewAnalysis.bestSan && <span> · Gợi ý: {currentReviewAnalysis.bestSan}</span>}</p> : <p>{reviewPly ? 'Chưa có đánh giá cho nước này.' : 'Vị trí bắt đầu'}</p>}</div><div><button type="button" disabled={!reviewPly} onClick={() => onSetReviewPly(Math.max(0, reviewPly - 1))} aria-label="Nước trước"><ChevronLeft size={18} /></button><button type="button" onClick={returnToGame}>Về ván đấu</button><button type="button" disabled={reviewPly === history.length} onClick={() => onSetReviewPly(Math.min(history.length, reviewPly + 1))} aria-label="Nước tiếp"><ChevronRight size={18} /></button></div></section>}
        <div className="play-actions"><button type="button" disabled={!isPlayerTurn || gameFinished || reviewMode || hintBusy} onClick={onShowHintMove}><Lightbulb size={17} />{hintBusy ? 'Đang tìm…' : 'Gợi ý'}</button><button type="button" disabled={!history.length || gameFinished} onClick={onUndoMove}><Undo2 size={17} />Đi lại</button><button type="button" disabled={!history.length} onClick={onReviewGame}><BookOpen size={17} />Đánh giá</button></div>
        <footer className="play-footer"><button type="button" onClick={() => onSetFlipped((value) => !value)}><RefreshCw size={16} />Xoay bàn</button><button type="button" onClick={askNewGame}><RotateCcw size={16} />Ván mới</button><button type="button" disabled={gameFinished || reviewMode} onClick={() => setConfirmAction('resign')}><Flag size={16} />Đầu hàng</button></footer>
        {confirmAction && <div className="play-confirm" role="group" aria-label="Xác nhận thao tác"><p>{confirmAction === 'resign' ? 'Bạn muốn đầu hàng ván đấu này?' : 'Bắt đầu lại và bỏ ván đấu đang chơi?'}</p><button type="button" onClick={() => { if (confirmAction === 'resign') onResignGame(); else onStartNewGame(); setConfirmAction(''); }}>Xác nhận</button><button type="button" onClick={() => setConfirmAction('')}>Tiếp tục chơi</button></div>}
      </>}
    </aside>
  );
}
