import React from 'react';
import { Check, Loader2, LogIn, RefreshCw, Search, Swords, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { sendGameInvitation } from '../../api/gameInvitations';
import { fetchFriends, removeFriendship, respondFriendRequest, searchUsers, sendFriendRequest } from '../../api/friends';
import Pagination from '../../components/Pagination';
import { discoverFriends, friendRating, friendOnline, FRIEND_MODES } from '../../api/friendDiscovery';

const TABS = [
  { id: 'friends', label: 'Bạn bè' },
  { id: 'requests', label: 'Lời mời' },
  { id: 'search', label: 'Tìm người chơi' }
];
const PAGE_SIZE = 8;

function presenceLabel(presence) {
  if (!presence?.online) return 'Offline';
  if (presence.status === 'playing') return 'Đang chơi';
  if (presence.status === 'queue') return 'Đang tìm trận';
  return 'Online';
}

function openProfile(userId) {
  if (!userId) return;
  window.history.pushState(null, '', `/profile/${encodeURIComponent(userId)}`);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
}

function PlayerAvatar({ user }) {
  return (
    <span className={`friend-avatar ${user?.presence?.online ? 'online' : ''}`}>
      {user?.photoURL ? <img src={user.photoURL} alt="" /> : <Users size={22} />}
    </span>
  );
}

function FriendPlayer({ item, onChallenge, onRemove, busyId, mode, now }) {
  const user = item.user;
  const online = friendOnline(user, now);
  const rating = friendRating(user, mode);
  return (
    <article className="friend-card">
      <button className="friend-main" onClick={() => openProfile(user?.id)} type="button">
        <PlayerAvatar user={user} />
        <span>
          <strong>{user?.displayName || 'Player'}</strong>
          <small>@{user?.username || 'player'} - {presenceLabel({ ...user?.presence, online })}</small>
          <small>{rating === null ? 'Chưa có Elo thi đấu' : `${rating} Elo`} · {mode}</small>
          {!online && user?.lastActiveAt && <small>Hoạt động: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(user.lastActiveAt))}</small>}
        </span>
      </button>
      <div className="friend-actions">
        <button disabled={busyId === item.id} onClick={() => onChallenge(item)} type="button">
          <Swords size={16} /> Thách đấu
        </button>
        <button className="secondary danger" disabled={busyId === item.id} onClick={() => onRemove(item)} type="button">
          <UserMinus size={16} /> Hủy bạn
        </button>
      </div>
    </article>
  );
}

function RequestCard({ item, outgoing = false, onAccept, onDecline, onCancel, busyId }) {
  const user = item.user;
  return (
    <article className="friend-card">
      <button className="friend-main" onClick={() => openProfile(user?.id)} type="button">
        <PlayerAvatar user={user} />
        <span>
          <strong>{user?.displayName || 'Player'}</strong>
          <small>@{user?.username || 'player'} - {outgoing ? 'Đang chờ phản hồi' : 'Muốn kết bạn'}</small>
        </span>
      </button>
      <div className="friend-actions">
        {outgoing ? (
          <button className="secondary danger" disabled={busyId === item.id} onClick={() => onCancel(item)} type="button">
            <X size={16} /> Hủy lời mời
          </button>
        ) : (
          <>
            <button disabled={busyId === item.id} onClick={() => onAccept(item)} type="button">
              <Check size={16} /> Đồng ý
            </button>
            <button className="secondary danger" disabled={busyId === item.id} onClick={() => onDecline(item)} type="button">
              <X size={16} /> Từ chối
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function SearchResult({ user, onAdd, busyId }) {
  const status = user.friendship?.status || 'none';
  const canAdd = status === 'none' || status === 'declined';
  const label = status === 'friends'
    ? 'Đã là bạn'
    : status === 'outgoing'
      ? 'Đã gửi lời mời'
      : status === 'incoming'
        ? 'Đang chờ bạn phản hồi'
        : 'Kết bạn';
  return (
    <article className="friend-card">
      <button className="friend-main" onClick={() => openProfile(user.id)} type="button">
        <PlayerAvatar user={user} />
        <span>
          <strong>{user.displayName}</strong>
          <small>@{user.username} - {presenceLabel(user.presence)}</small>
        </span>
      </button>
      <div className="friend-actions">
        <button disabled={!canAdd || busyId === user.id} onClick={() => onAdd(user)} type="button">
          <UserPlus size={16} /> {label}
        </button>
      </div>
    </article>
  );
}



function pageSlice(items, page) {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

export default function FriendsPage({ authUser, onLogin }) {
  const [activeTab, setActiveTab] = React.useState('friends');
  const [friendsPage, setFriendsPage] = React.useState(1);
  const [requestsPage, setRequestsPage] = React.useState(1);
  const [searchPage, setSearchPage] = React.useState(1);
  const [friends, setFriends] = React.useState([]);
  const [incoming, setIncoming] = React.useState([]);
  const [outgoing, setOutgoing] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [searching, setSearching] = React.useState(false);
  const [challengeTime, setChallengeTime] = React.useState('600+0');
  const [challengeSide, setChallengeSide] = React.useState('random');
  const [busyId, setBusyId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [viewer, setViewer] = React.useState(null);
  const [filters, setFilters] = React.useState({ mode: 'rapid', status: 'all', gap: 'all', sort: 'recommended', query: '' });
  const [now, setNow] = React.useState(Date.now);
  const clockOffset = React.useRef(0);
  const friendRequest = React.useRef(0);
  const searchRequest = React.useRef(0);


  const loadFriends = React.useCallback(async (silent = false) => {
    if (!authUser) return;
    const requestId = ++friendRequest.current;
    if (!silent) { setLoading(true); setMessage(''); }
    try {
      const data = await fetchFriends();
      if (requestId !== friendRequest.current) return;
      setFriends(data.friends || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
      setViewer(data.viewer || null);
      clockOffset.current = data.serverNow ? Date.parse(data.serverNow) - Date.now() : 0;
      setNow(Date.now() + clockOffset.current);
    } catch (error) {
      if (requestId === friendRequest.current && !silent) setMessage(error.message);
    } finally {
      if (requestId === friendRequest.current) setLoading(false);
    }
  }, [authUser]);

  React.useEffect(() => {
    loadFriends();
    const timer = window.setInterval(() => {
      setNow(Date.now() + clockOffset.current);
      if (document.visibilityState === 'visible') loadFriends(true);
    }, 30000);
    return () => { window.clearInterval(timer); friendRequest.current += 1; };
  }, [loadFriends]);

  const changeFilter = (name, value) => {
    setFilters(current => ({ ...current, [name]: value, ...(name === 'mode' ? { gap: 'all' } : {}) }));
    setFriendsPage(1);
  };
  const filteredFriends = React.useMemo(() => discoverFriends(friends, viewer, filters, now), [friends, viewer, filters, now]);

  React.useEffect(() => {
    const requestId = ++searchRequest.current;
    const controller = new AbortController();
    setSearching(false);
    if (!authUser || query.trim().length < 2) {
      setResults([]);
      setSearchPage(1);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setMessage('');
      try {
        const data = await searchUsers(query, { signal: controller.signal });
        if (controller.signal.aborted || requestId !== searchRequest.current) return;
        setResults(data.users || []);
        setSearchPage(1);
      } catch (error) {
        if (!controller.signal.aborted && requestId === searchRequest.current) setMessage(error.message);
      } finally {
        if (requestId === searchRequest.current) setSearching(false);
      }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); searchRequest.current += 1; };
  }, [authUser, query]);

  const reloadAfterAction = async () => {
    const requestId = searchRequest.current;
    await loadFriends();
    if (query.trim().length >= 2) {
      const data = await searchUsers(query);
      if (requestId === searchRequest.current) setResults(data.users || []);
    }
  };

  const addFriend = async (user) => {
    setBusyId(user.id);
    setMessage('');
    try {
      await sendFriendRequest(user.id);
      setMessage(`Đã gửi lời mời kết bạn tới ${user.displayName}.`);
      await reloadAfterAction();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };

  const respond = async (item, response) => {
    setBusyId(item.id);
    setMessage('');
    try {
      await respondFriendRequest(item.id, response);
      setMessage(response === 'accepted' ? 'Đã chấp nhận lời mời kết bạn.' : 'Đã từ chối lời mời kết bạn.');
      await reloadAfterAction();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    setMessage('');
    try {
      await removeFriendship({ friendshipId: item.id });
      setMessage('Đã cập nhật danh sách bạn bè.');
      await reloadAfterAction();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };

  const challenge = async (item) => {
    setBusyId(item.id);
    setMessage('');
    try {
      await sendGameInvitation(item.user?.id, challengeTime, challengeSide);
      setMessage('Đã gửi lời mời. Bạn của bạn sẽ nhận thông báo và cả hai vào trận khi lời mời được chấp nhận.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };



  const requestItems = React.useMemo(() => [
    ...incoming.map((item) => ({ ...item, direction: 'incoming' })),
    ...outgoing.map((item) => ({ ...item, direction: 'outgoing' }))
  ], [incoming, outgoing]);
  const friendsTotalPages = Math.max(1, Math.ceil(filteredFriends.length / PAGE_SIZE));
  const visibleFriendsPage = Math.min(friendsPage, friendsTotalPages);
  const requestsTotalPages = Math.max(1, Math.ceil(requestItems.length / PAGE_SIZE));
  const searchTotalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  if (!authUser) {
    return (
      <section className="friends-auth-required">
        <Users size={48} />
        <h1>Bạn bè</h1>
        <p>Đăng nhập để tìm người chơi, gửi lời mời kết bạn và thách đấu bạn bè online.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="friends-page">
      <header className="friends-hero">
        <div className="friends-hero-copy">
          <span><Users size={18} /> ChessArena Social</span>
          <h1>Bạn bè và thách đấu</h1>
          <p>Quản lý danh sách bạn bè, theo dõi trạng thái online và tạo lời mời chơi cờ trực tiếp.</p>
        </div>
        <div className="friends-hero-stats" aria-label="Tổng quan bạn bè">
          <article><strong>{friends.length}</strong><small>Bạn bè</small></article>
          <article><strong>{friends.filter((item) => friendOnline(item.user, now)).length}</strong><small>Đang online</small></article>
          <article><strong>{incoming.length}</strong><small>Lời mời mới</small></article>
        </div>
        <button
          className="friends-refresh-button"
          disabled={loading}
          onClick={() => loadFriends()}
          type="button"
        >
          <RefreshCw size={17} className={loading ? 'social-spin' : ''} />
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </header>

      <nav className="friends-tabs" aria-label="Friends tabs">
        {TABS.map((tab) => (
          <button
            className={activeTab === tab.id ? 'active' : ''}
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setFriendsPage(1);
              setRequestsPage(1);
              setSearchPage(1);
            }}
            type="button"
          >
            {tab.label}
            {tab.id === 'requests' && incoming.length > 0 && <b>{incoming.length}</b>}
          </button>
        ))}
      </nav>

      <div className="friends-challenge-options">
        <label>Thời gian trận mời <select value={challengeTime} onChange={(event) => setChallengeTime(event.target.value)}>
          <option value="180+0">3 phút</option><option value="300+0">5 phút</option><option value="600+0">10 phút</option><option value="900+10">15 phút + 10 giây</option>
        </select></label>
        <label>Quân của bạn <select value={challengeSide} onChange={(event) => setChallengeSide(event.target.value)}>
          <option value="random">Ngẫu nhiên</option><option value="w">Trắng</option><option value="b">Đen</option>
        </select></label>
      </div>
      {message && <p className="friends-message">{message}</p>}

      {activeTab === 'friends' && <section className="friends-discovery" aria-label="Bộ lọc bạn bè">
        <div className="friends-filter-grid">
          <label>Tìm trong bạn bè<input value={filters.query} onChange={event => changeFilter('query', event.target.value)} placeholder="Tên hoặc username" /></label>
          <label>Elo theo chế độ<select value={filters.mode} onChange={event => changeFilter('mode', event.target.value)}>
            {FRIEND_MODES.map(mode => <option key={mode} value={mode}>{mode[0].toUpperCase() + mode.slice(1)}</option>)}
          </select></label>
          <label>Hoạt động<select value={filters.status} onChange={event => changeFilter('status', event.target.value)}>
            <option value="all">Tất cả</option><option value="available">Online, chưa vào trận</option><option value="online">Đang online</option><option value="day">Trong 24 giờ</option><option value="week">Trong 7 ngày</option>
          </select></label>
          <label>Chênh lệch Elo<select value={filters.gap} disabled={friendRating(viewer, filters.mode) === null} onChange={event => changeFilter('gap', event.target.value)}>
            <option value="all">Không giới hạn</option><option value="100">Trong ±100 Elo</option><option value="200">Trong ±200 Elo</option><option value="400">Trong ±400 Elo</option>
          </select></label>
          <label>Ưu tiên hiển thị<select value={filters.sort} onChange={event => changeFilter('sort', event.target.value)}>
            <option value="recommended">Phù hợp để thách đấu</option><option value="rating">Elo gần tôi nhất</option><option value="recent">Hoạt động gần nhất</option>
          </select></label>
        </div>
        <p>{filteredFriends.length}/{friends.length} bạn bè · {friendRating(viewer, filters.mode) === null ? `Bạn chưa có Elo ${filters.mode}; hoàn thành một trận xếp hạng để lọc chênh lệch.` : `Elo ${filters.mode} của bạn: ${friendRating(viewer, filters.mode)}.`}</p>
        <small>Gợi ý ưu tiên người online chưa vào trận, rồi Elo gần bạn và hoạt động gần đây. Người chưa có Elo được hiển thị sau khi so trình độ; bộ lọc không thay đổi quyền gửi lời mời.</small>
      </section>}


      {activeTab === 'friends' && (
        <div className="friends-list">
          {loading ? (
            <div className="social-loading">
              <Loader2 size={38} className="social-spin" />
              <span>Đang tải danh sách bạn bè...</span>
            </div>
          ) : friends.length === 0 ? (
            <p className="friends-empty">Chưa có bạn bè. Mở tab Tìm người chơi để gửi lời mời kết bạn.</p>
          ) : filteredFriends.length === 0 ? (
            <p className="friends-empty">Không có bạn bè phù hợp bộ lọc. Hãy mở rộng hoạt động hoặc chênh lệch Elo.</p>
          ) : (
            <>
              {pageSlice(filteredFriends, visibleFriendsPage).map((item) => (
                <FriendPlayer item={item} busyId={busyId} key={item.id} onChallenge={challenge} onRemove={remove} mode={filters.mode} now={now} />
              ))}
              <Pagination page={visibleFriendsPage} totalPages={friendsTotalPages} onPageChange={setFriendsPage} label="Phân trang bạn bè" />
            </>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="friends-list">
          {loading ? (
            <div className="social-loading">
              <Loader2 size={38} className="social-spin" />
              <span>Đang tải lời mời...</span>
            </div>
          ) : requestItems.length === 0 ? (
            <p className="friends-empty">Chưa có lời mời kết bạn nào.</p>
          ) : (
            <>
              {pageSlice(requestItems, requestsPage).map((item) => (
                item.direction === 'incoming' ? (
                  <RequestCard
                    item={item}
                    busyId={busyId}
                    key={item.id}
                    onAccept={(request) => respond(request, 'accepted')}
                    onDecline={(request) => respond(request, 'declined')}
                  />
                ) : (
                  <RequestCard item={item} outgoing busyId={busyId} key={item.id} onCancel={remove} />
                )
              ))}
              <Pagination page={requestsPage} totalPages={requestsTotalPages} onPageChange={setRequestsPage} label="Phân trang lời mời" />
            </>
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="friends-search-panel">
          <label className="friends-search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo username hoặc tên hiển thị..." />
          </label>

          {searching ? (
            <div className="social-loading">
              <Loader2 size={38} className="social-spin" />
              <span>Đang tìm người chơi...</span>
            </div>
          ) : query.trim().length >= 2 && results.length === 0 ? (
            <p className="friends-empty">Không tìm thấy người chơi phù hợp.</p>
          ) : (
            <>
              <div className="friends-list">
                {pageSlice(results, searchPage).map((user) => (
                  <SearchResult user={user} busyId={busyId} key={user.id} onAdd={addFriend} />
                ))}
              </div>
              {results.length > 0 && (
                <Pagination page={searchPage} totalPages={searchTotalPages} onPageChange={setSearchPage} label="Phân trang tìm người chơi" />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
