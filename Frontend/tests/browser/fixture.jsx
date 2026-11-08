import React from 'react';
import { createRoot } from 'react-dom/client';
import GameInvitationHost from '../../src/components/GameInvitationHost';
import FriendsPage from '../../src/routes/use/FriendsPage';
import LeaderboardPage from '../../src/routes/use/LeaderboardPage';
import '../../src/styles/leaderboard.css';
import MembershipPage from '../../src/routes/use/MembershipPage';
import OnlinePage from '../../src/routes/use/OnlinePage';
import HistoryPage from '../../src/routes/use/HistoryPage';
import NotificationsPage from '../../src/routes/use/NotificationsPage';
import Pagination from '../../src/components/Pagination';
import TopHeader from '../../src/components/TopHeader';
import { Chess } from 'chess.js';
import { useApiGameLog } from '../../src/hooks/useApiGameLog';
import { useGameReview } from '../../src/hooks/useGameReview';
import '../../src/styles.css';
import '../../src/styles/social-center.css';
import '../../src/styles/puzzle-premium.css';
import '../../src/styles/interface.css';
import '../../src/styles/play-workspace.css';

const id = new URLSearchParams(location.search).get('user') || '11111111-1111-4111-8111-111111111111';
const authUser = { uid: id, id, displayName: id.startsWith('1') ? 'Người gửi' : 'Người nhận' };
const membership = { tier: 'pro', status: 'active', provider: 'paypal', billingCycle: 'monthly', currentPeriodEnd: new Date(Date.now()+30*86400000).toISOString(), autoRenew: true, cancelAtPeriodEnd: false };
function LogFixture() {
  const [gameId,setGameId] = React.useState('finished-first');
  const game = React.useMemo(() => { const chess=new Chess(); for(const san of ['f3','e5','g4','Qh4#']) chess.move(san); return chess; }, []);
  const { apiOnline } = useApiGameLog({ game, gameFen:game.fen(), historyLength:4, gameId,
    playerColor:'w', aiLevel:{elo:1200}, userId:'tester',userName:'Tester',ownerId:'tester',timeControl:{id:'600+0'},outcomeResult:'0-1' });
  return <><span>{apiOnline ? 'Saved' : 'Saving'}</span><button onClick={()=>setGameId('finished-second')}>Next game</button></>;
}
function Fixture() {
  const [page,setPage] = React.useState(1);
  const [path,setPath] = React.useState(location.pathname);
  const [plan,setPlan] = React.useState(membership);
  React.useEffect(()=>{const listener=()=>setPath(location.pathname);window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);},[]);
  if (new URLSearchParams(location.search).get('view') === 'leaderboard') return <LeaderboardPage authUser={authUser} />;
  if (new URLSearchParams(location.search).get('view') === 'reviewQueue') return <ReviewQueueFixture />;
  if (new URLSearchParams(location.search).get('view') === 'pagination') return <Pagination page={page} totalPages={30} onPageChange={setPage} />;
  if (new URLSearchParams(location.search).get('view') === 'membership') return <MembershipPage authUser={authUser} membership={plan} onMembershipUpdated={setPlan} />;
  if (new URLSearchParams(location.search).get('view') === 'history') return <HistoryPage authUser={authUser} onOpenReview={() => {}} />;
  if (new URLSearchParams(location.search).get('view') === 'notifications') return <NotificationsPage authUser={authUser} />;
  if (new URLSearchParams(location.search).get('view') === 'log') return <LogFixture />;
  if (new URLSearchParams(location.search).get('view') === 'notificationHeader') return <NotificationHeaderFixture />;
  if (new URLSearchParams(location.search).get('view') === 'online') return <OnlinePage authUser={authUser} userName={authUser.displayName} pieceSet="neo" theme={{}} membership={plan} />;
  return <><GameInvitationHost authUser={authUser} />{path==='/play/online'
    ? <OnlinePage authUser={authUser} userName={authUser.displayName} pieceSet="neo" theme={{}} membership={plan} />
    : <FriendsPage authUser={authUser} />}</>;
}

function NotificationHeaderFixture() {
  const [count, setCount] = React.useState(1);
  const [path, setPath] = React.useState(location.pathname);
  React.useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return <main className="app-shell" data-color-scheme="light">
    <aside className="sidebar">ChessArena</aside>
    <section className="content-shell">
    <TopHeader
      activeRoute="home"
      apiOnline
      settingsOpen={false}
      theme={{accent:'#7c3aed',lightSquare:'#f0d9b5',darkSquare:'#b58863',surface:'#fff',page:'#fff'}}
      appearance="light"
      pieceSet="neo"
      authUser={authUser}
      notificationCount={count}
      onNotificationCountChange={setCount}
      onOpenNotifications={() => { window.history.pushState(null,'','/notifications'); window.dispatchEvent(new PopStateEvent('popstate')); }}
    />
    <button type="button" data-testid="outside">Ngoài popover</button>
    <output data-testid="notification-path">{path}</output>
    <output data-testid="notification-count">{count}</output>
    </section>
  </main>;
}

function ReviewQueueFixture() {
  const [moves, setMoves] = React.useState([]);
  const [id, setId] = React.useState(1);
  const game = React.useMemo(() => { const board = new Chess(); moves.forEach(move => board.move(move)); return board; }, [moves]);
  const history = React.useMemo(() => game.history({verbose:true}), [game]);
  const review = useGameReview({game,history,initialFen:null,gameVariant:'standard',isCoachGame:true,coachMode:'basic',gameId:id});
  return <><button onClick={() => setMoves(current => [...current, ['e4','e5','Nf3'][current.length]])}>Append</button><button onClick={() => {setId(value=>value+1);setMoves([]);review.setPendingAnalysis([]);review.setStockfishReview([]);}}>Reset</button><button onClick={review.retryReview}>Retry</button><output data-testid="review-results">{review.stockfishReview.filter(Boolean).map(item=>item.san).join(',')}</output><output data-testid="review-status">{review.stockfishStatus}</output></>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
