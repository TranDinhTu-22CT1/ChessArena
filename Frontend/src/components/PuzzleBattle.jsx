import React from 'react';
import { Chess } from 'chess.js';
import { Swords, Timer, Trophy, UserRound } from 'lucide-react';
import { answerPuzzleBattle, cancelPuzzleBattle, fetchPuzzleBattle, joinPuzzleBattle } from '../api/puzzles';
import { pollWhileActive } from '../api/polling';

const clock = ms => `${Math.floor(Math.max(0, Math.ceil(ms / 1000)) / 60)}:${String(Math.max(0, Math.ceil(ms / 1000)) % 60).padStart(2, '0')}`;

export default function PuzzleBattle({ pieceSet, authUser, Board }) {
  const [battle, setBattle] = React.useState(null);
  const [position, setPosition] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [promotion, setPromotion] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [restoring, setRestoring] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [connectionError, setConnectionError] = React.useState('');
  const [remaining, setRemaining] = React.useState(0);
  const anchor = React.useRef(null);
  const busyRef = React.useRef(false);
  const mutation = React.useRef(0);
  const expiryRequested = React.useRef(null);
  const latestBattle = React.useRef(null);
  const identity = authUser?.uid || authUser?.id || '';
  const storageKey = `chessarena-puzzle-battle:${identity}`;

  const apply = React.useCallback(next => {
    const previous = latestBattle.current;
    if (next?.id && next.id === previous?.id && (
      (['finished', 'cancelled'].includes(previous.status) && next.status !== previous.status)
      || next.index < previous.index || next.opponentIndex < previous.opponentIndex
    )) return;
    latestBattle.current = next;
    setBattle(next);
    setConnectionError('');
    const ms = Math.max(0, Date.parse(next?.expiresAt || '') - Date.parse(next?.serverNow || new Date().toISOString()));
    anchor.current = { at: window.performance.now(), ms: Number.isFinite(ms) ? ms : 0 };
    setRemaining(anchor.current.ms);
    try {
      if (next?.id) sessionStorage.setItem(storageKey, next.id);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Storage is only a restoration hint. */ }
  }, [storageKey]);

  React.useEffect(() => {
    latestBattle.current = null;
    setBattle(null);
    if (!identity) { setRestoring(false); return; }
    const controller = new AbortController();
    setRestoring(true);
    let id = '';
    try { id = sessionStorage.getItem(storageKey) || ''; } catch { /* Read from the server. */ }
    fetchPuzzleBattle(id, controller.signal).then(data => {
      if (!controller.signal.aborted) apply(data.battle);
    }).catch(error => { if (!controller.signal.aborted) setConnectionError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [identity, storageKey, apply]);

  React.useEffect(() => {
    setPosition(battle?.puzzle?.fen ? new Chess(battle.puzzle.fen) : null);
    setSelected(null); setTargets([]); setPromotion(null);
  }, [battle?.id, battle?.index, battle?.puzzle?.fen]);

  React.useEffect(() => {
    if (!battle?.id || !['waiting', 'active'].includes(battle.status)) return;
    return pollWhileActive(async signal => {
      if (busyRef.current) return;
      const version = mutation.current;
      try {
        const data = await fetchPuzzleBattle(battle.id, signal);
        if (!signal.aborted && version === mutation.current) apply(data.battle);
      } catch (error) {
        if (!signal.aborted) setConnectionError('Kết nối bị gián đoạn. Đang thử đồng bộ lại…');
        throw error;
      }
    }, { interval: 1500, maxDelay: 6000 });
  }, [battle?.id, battle?.status, apply]);

  React.useEffect(() => {
    if (!['waiting', 'active'].includes(battle?.status)) return;
    const timer = setInterval(() => {
      if (anchor.current) setRemaining(Math.max(0, anchor.current.ms - (window.performance.now() - anchor.current.at)));
    }, 200);
    return () => clearInterval(timer);
  }, [battle?.status]);

  React.useEffect(() => {
    if (remaining > 0 || busy || !battle?.id || !['waiting', 'active'].includes(battle.status)) return;
    const key = `${battle.id}:${battle.expiresAt}`;
    if (expiryRequested.current === key) return;
    expiryRequested.current = key;
    const controller = new AbortController(), version = mutation.current;
    fetchPuzzleBattle(battle.id, controller.signal).then(data => {
      if (!controller.signal.aborted && version === mutation.current) apply(data.battle);
    }).catch(() => { if (!controller.signal.aborted) setConnectionError('Đang kết nối để xác nhận kết quả…'); });
    return () => controller.abort();
  }, [remaining, busy, battle?.id, battle?.status, battle?.expiresAt, apply]);

  const act = async task => {
    if (busyRef.current) return;
    busyRef.current = true; mutation.current++; setBusy(true);
    try { const data = await task(); apply(data.battle); return data; }
    catch (error) { setConnectionError(error.name === 'TimeoutError' ? 'Kết nối quá lâu. Hãy thử lại; điểm đã ghi trên máy chủ được giữ nguyên.' : error.message); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const join = () => { setMessage(''); return act(joinPuzzleBattle); };
  const submit = async move => {
    if (!battle?.puzzle || battle.status !== 'active' || remaining <= 0) return;
    setPromotion(null);
    const data = await act(() => answerPuzzleBattle(battle.id, move.lan, battle.index, battle.puzzle.id));
    if (data) setMessage(data.correct ? 'Chính xác · +1 điểm' : 'Chưa đúng · 0 điểm. Thử câu tiếp theo.');
  };
  const play = async square => {
    if (!position || busy || remaining <= 0) return;
    const piece = position.get(square);
    if (piece?.color === position.turn()) {
      setSelected(square); setTargets(position.moves({square, verbose:true}).map(move => move.to)); return;
    }
    if (!selected) return;
    const choices = position.moves({square:selected, verbose:true}).filter(move => move.to === square);
    setSelected(null); setTargets([]);
    if (choices.some(move => move.promotion)) setPromotion(choices);
    else if (choices[0]) await submit(choices[0]);
  };

  const rules = <p className="battle-rules">Cùng bộ {battle?.total || 10} câu · tối đa 5 phút. Đúng +1 điểm, sai 0 điểm và sang câu tiếp. Kết thúc khi hết giờ hoặc cả hai làm hết; điểm cao hơn thắng, bằng điểm là hòa. Không thay đổi Elo câu đố.</p>;
  const error = connectionError && <p role="alert" className="battle-error">{connectionError}</p>;
  if (!authUser) return <section className="puzzle-unavailable"><Swords size={36}/><h2>Đăng nhập để chơi Puzzle Battle</h2>{rules}</section>;
  if (restoring) return <section className="puzzle-unavailable" role="status">Đang kiểm tra trận đang chơi…</section>;
  if (!battle || battle.status === 'cancelled') return <section className="puzzle-unavailable battle-lobby">
    <Swords size={38}/><h2>Thử sức cùng người chơi khác</h2>{rules}
    {battle?.status === 'cancelled' && <p>Hàng chờ đã đóng. Bạn có thể tìm lại.</p>}
    <button type="button" disabled={busy} onClick={join}>{busy ? 'Đang kết nối…' : 'Tìm đối thủ'}</button>{error}
  </section>;

  const finished = battle.status === 'finished';
  const waiting = battle.status === 'waiting';
  const scoreboard = <section className="battle-scoreboard" aria-label="Bảng điểm Puzzle Battle">
    <header><span><Swords size={18}/> {finished ? 'Kết quả' : waiting ? 'Đang tìm đối thủ' : 'Đang thi đấu'}</span>
      {!finished && <b className={remaining < 30000 ? 'battle-clock low' : 'battle-clock'} aria-label={waiting ? 'Thời gian chờ còn lại' : 'Thời gian trận còn lại'}><Timer size={18}/>{clock(remaining)}</b>}
    </header>
    <div className="battle-players">
      <BattlePlayer profile={battle.you} label="Bạn" score={battle.score} index={battle.index} total={battle.total} mistakes={battle.mistakes}/>
      <span className="battle-versus">VS</span>
      <BattlePlayer profile={battle.opponent} label={waiting ? 'Đang tìm…' : 'Đối thủ'} score={battle.opponentScore} index={battle.opponentIndex} total={battle.total} mistakes={battle.opponentMistakes}/>
    </div>
    {error}
  </section>;
  if (waiting) return <div className="battle-workspace">{scoreboard}<section className="puzzle-unavailable"><h2>Đang chờ người chơi thứ hai</h2><p>Đồng hồ thi đấu bắt đầu khi ghép được đối thủ.</p>{rules}<button type="button" disabled={busy} onClick={() => act(() => cancelPuzzleBattle(battle.id))}>Hủy tìm</button></section></div>;
  if (finished) return <div className="battle-workspace">{scoreboard}<section className="puzzle-unavailable battle-result"><Trophy size={40}/><h2>{battle.winnerUserId === null ? 'Trận hòa' : battle.won ? 'Bạn thắng!' : `${battle.opponent?.name || 'Đối thủ'} thắng`}</h2><p>{battle.finishReason === 'completed' ? 'Cả hai đã hoàn thành bộ câu đố.' : 'Đã hết thời gian thi đấu.'}</p>{rules}<button type="button" disabled={busy} onClick={join}>Tìm trận mới</button></section></div>;
  return <div className="battle-workspace">{scoreboard}
    {battle.puzzle && position ? <section className="puzzle-play-layout puzzle-battle-live">
      <Board position={position} flipped={position.turn() === 'b'} pieceSet={pieceSet} selected={selected} targets={targets} onSelectSquare={play} disabled={busy || remaining <= 0 || Boolean(promotion)} promotion={promotion} onPromote={submit} onCancelPromotion={() => setPromotion(null)}/>
      <aside className="puzzle-panel battle-instructions"><span>Puzzle Battle</span><h2>Câu {battle.index + 1} / {battle.total}</h2><strong>{position.turn() === 'w' ? 'Trắng' : 'Đen'} đi · Elo câu đố {battle.puzzle.rating}</strong><p role="status">{remaining <= 0 ? 'Hết giờ · đang xác nhận kết quả…' : busy ? 'Đang kiểm tra nước đi…' : message || 'Tìm nước đi tốt nhất.'}</p>{rules}</aside>
    </section> : <section className="puzzle-unavailable"><Timer size={36}/><h2>{remaining <= 0 ? 'Đang xác nhận kết quả' : 'Bạn đã làm hết câu đố'}</h2><p>Đang chờ đối thủ hoàn thành hoặc đồng hồ về 0. Điểm của bạn được giữ nguyên.</p>{rules}</section>}
  </div>;
}

function BattlePlayer({ profile, label, score = 0, index = 0, total, mistakes = 0 }) {
  return <article className="battle-player">
    <div className="battle-avatar"><UserRound size={24}/>{profile?.photoURL && <img src={profile.photoURL} alt="" onError={event => { event.currentTarget.style.display = 'none'; }}/>}</div>
    <div className="battle-player-info"><small>{label}</small><strong>{profile?.name || 'Chờ đối thủ'}</strong><span>{index}/{total} đã làm · {mistakes} sai</span><progress aria-label={`${label}: tiến độ`} value={index} max={total}/></div>
    <b className="battle-score" aria-label={`${label}: điểm`}>{score}</b>
  </article>;
}
