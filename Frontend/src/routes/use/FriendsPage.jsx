import React from 'react';
import { Check, Copy, LogIn, RefreshCw, Search, Swords, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { createFriendGame } from '../../api/online';
import { fetchFriends, removeFriendship, respondFriendRequest, searchUsers, sendFriendRequest } from '../../api/friends';

const TABS = [
  { id: 'friends', label: 'Bạn bè' },
  { id: 'requests', label: 'Lời mời' },
  { id: 'search', label: 'Tìm người chơi' }
];

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
    <span className="friend-avatar">
      {user?.photoURL ? <img src={user.photoURL} alt="" /> : <Users size={22} />}
    </span>
  );
}

function FriendPlayer({ item, onChallenge, onRemove, busyId }) {
  const user = item.user;
  return (
    <article className="friend-card">
      <button className="friend-main" onClick={() => openProfile(user?.id)} type="button">
        <PlayerAvatar user={user} />
        <span>
          <strong>{user?.displayName || 'Player'}</strong>
          <small>@{user?.username || 'player'} - {presenceLabel(user?.presence)}</small>
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

function formatInviteExpiry(value) {
  if (!value) return '10 phút';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function FriendsPage({ authUser, onLogin }) {
  const [activeTab, setActiveTab] = React.useState('friends');
  const [friends, setFriends] = React.useState([]);
  const [incoming, setIncoming] = React.useState([]);
  const [outgoing, setOutgoing] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [searching, setSearching] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [invite, setInvite] = React.useState(null);

  const loadFriends = React.useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchFriends();
      setFriends(data.friends || []);
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  React.useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  React.useEffect(() => {
    if (!authUser || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setMessage('');
      try {
        const data = await searchUsers(query);
        setResults(data.users || []);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [authUser, query]);

  const reloadAfterAction = async () => {
    await loadFriends();
    if (query.trim().length >= 2) {
      const data = await searchUsers(query);
      setResults(data.users || []);
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
      const data = await createFriendGame('600+0', 'random', item.user?.id);
      const link = `${window.location.origin}/play/online?invite=${data.inviteCode}`;
      setInvite({ code: data.inviteCode, link, name: item.user?.displayName || 'Player', expiresAt: data.expiresAt });
      setMessage(`Đã tạo lời mời thách đấu cho ${item.user?.displayName || 'người chơi'}. Link hết hạn lúc ${formatInviteExpiry(data.expiresAt)}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  };

  const copyInvite = async () => {
    if (!invite?.link) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setMessage('Đã copy link thách đấu.');
    } catch {
      setMessage(invite.link);
    }
  };

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
        <div>
          <span><Users size={18} /> ChessArena Social</span>
          <h1>Bạn bè và thách đấu</h1>
          <p>Quản lý danh sách bạn bè, theo dõi trạng thái online và tạo lời mời chơi cờ trực tiếp.</p>
        </div>
        <button disabled={loading} onClick={loadFriends} type="button">
          <RefreshCw size={17} /> {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </header>

      <nav className="friends-tabs" aria-label="Friends tabs">
        {TABS.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
            {tab.id === 'requests' && incoming.length > 0 && <b>{incoming.length}</b>}
          </button>
        ))}
      </nav>

      {message && <p className="friends-message">{message}</p>}
      {invite && (
        <article className="friends-invite-card">
          <div>
            <span>Invite challenge</span>
            <strong>{invite.code}</strong>
            <small>Gửi link này cho {invite.name}. Link hết hạn lúc {formatInviteExpiry(invite.expiresAt)}.</small>
          </div>
          <button onClick={copyInvite} type="button"><Copy size={17} /> Copy link</button>
        </article>
      )}

      {activeTab === 'friends' && (
        <div className="friends-list">
          {!loading && friends.length === 0 && <p className="friends-empty">Chưa có bạn bè. Mở tab Tìm người chơi để gửi lời mời kết bạn.</p>}
          {friends.map((item) => (
            <FriendPlayer item={item} busyId={busyId} key={item.id} onChallenge={challenge} onRemove={remove} />
          ))}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="friends-list">
          <h2>Lời mời đến</h2>
          {incoming.length === 0 && <p className="friends-empty">Chưa có lời mời kết bạn mới.</p>}
          {incoming.map((item) => (
            <RequestCard
              item={item}
              busyId={busyId}
              key={item.id}
              onAccept={(request) => respond(request, 'accepted')}
              onDecline={(request) => respond(request, 'declined')}
            />
          ))}
          <h2>Lời mời đã gửi</h2>
          {outgoing.length === 0 && <p className="friends-empty">Bạn chưa gửi lời mời nào đang chờ phản hồi.</p>}
          {outgoing.map((item) => (
            <RequestCard item={item} outgoing busyId={busyId} key={item.id} onCancel={remove} />
          ))}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="friends-search-panel">
          <label className="friends-search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo username hoặc tên hiển thị..." />
          </label>
          {searching && <p className="friends-empty">Đang tìm người chơi...</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && <p className="friends-empty">Không tìm thấy người chơi phù hợp.</p>}
          <div className="friends-list">
            {results.map((user) => (
              <SearchResult user={user} busyId={busyId} key={user.id} onAdd={addFriend} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
