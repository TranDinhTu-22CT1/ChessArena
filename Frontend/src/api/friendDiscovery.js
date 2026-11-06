export const FRIEND_MODES = ['bullet', 'blitz', 'rapid', 'classical'];

export function friendRating(user, mode) {
  const value = user?.ratings?.[mode];
  return value?.gamesPlayed > 0 && Number.isFinite(value.rating) ? value.rating : null;
}

export function friendOnline(user, now = Date.now()) {
  if (!user?.presence?.online) return false;
  const seen = Date.parse(user.presence.lastSeen);
  return !Number.isFinite(seen) || seen >= now - 45_000;
}

export function discoverFriends(items, viewer, { mode = 'rapid', status = 'all', gap = 'all', sort = 'recommended', query = '' } = {}, now = Date.now()) {
  const myRating = friendRating(viewer, mode);
  const distance = user => {
    const rating = friendRating(user, mode);
    return myRating === null || rating === null ? Infinity : Math.abs(rating - myRating);
  };
  const activeAt = user => Date.parse(user.lastActiveAt || user.presence?.lastSeen) || 0;
  const readiness = user => friendOnline(user, now) ? (['playing', 'queue'].includes(user.presence.status) ? 1 : 0) : 2;
  const normalized = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const result = items.filter(({ user }) => {
    if (query && !normalized(`${user.displayName} ${user.username}`).includes(normalized(query.trim()))) return false;
    if (status === 'online' && !friendOnline(user, now)) return false;
    if (status === 'available' && readiness(user) !== 0) return false;
    const days = status === 'day' ? 1 : status === 'week' ? 7 : null;
    if (days && !friendOnline(user, now) && activeAt(user) < now - days * 86400000) return false;
    if (gap !== 'all' && distance(user) > Number(gap)) return false;
    return true;
  });
  return result.sort((a, b) => {
    const left = a.user, right = b.user;
    const ratingOrder = (distance(left) === distance(right) ? 0 : distance(left) < distance(right) ? -1 : 1);
    const readyOrder = readiness(left) - readiness(right);
    const recentOrder = activeAt(right) - activeAt(left);
    const primary = sort === 'rating' ? ratingOrder || readyOrder || recentOrder
      : sort === 'recent' ? recentOrder || readyOrder || ratingOrder
        : readyOrder || ratingOrder || recentOrder;
    return primary || String(left.id).localeCompare(String(right.id));
  });
}
