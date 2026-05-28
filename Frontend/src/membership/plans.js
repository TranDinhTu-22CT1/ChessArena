export const MEMBERSHIP_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    reviewLimit: 1,
    puzzleLimit: 5,
    rushLimit: 0,
    customPuzzles: false,
    moveExplain: false,
    insights: false,
    coachDepth: 'Basic',
    badge: 'Starter',
    summary: 'Chơi online, bot, 5 puzzle/ngày và 1 review cơ bản/ngày.'
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    reviewLimit: 10,
    puzzleLimit: 80,
    rushLimit: Infinity,
    customPuzzles: false,
    moveExplain: false,
    insights: false,
    coachDepth: 'Smart',
    badge: 'Plus',
    summary: 'Mở Puzzle Rush, nhiều puzzle hơn và 10 review cơ bản mỗi ngày.'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    reviewLimit: Infinity,
    puzzleLimit: Infinity,
    rushLimit: Infinity,
    customPuzzles: true,
    moveExplain: true,
    insights: true,
    coachDepth: 'Deep',
    badge: 'Pro',
    summary: 'Không giới hạn review/puzzle, mở Custom Puzzles và giải thích nước đi.'
  },
  master: {
    id: 'master',
    name: 'Master',
    reviewLimit: Infinity,
    puzzleLimit: Infinity,
    rushLimit: Infinity,
    customPuzzles: true,
    moveExplain: true,
    insights: true,
    priorityMatchmaking: true,
    advancedCoach: true,
    coachDepth: 'Tournament',
    badge: 'Master',
    summary: 'Toàn bộ Pro, thêm định hướng luyện tập nâng cao và huy hiệu Master.'
  }
};

export const PAID_TIERS = ['plus', 'pro', 'master'];

export function activeTier(membership) {
  return membership?.status === 'active' && MEMBERSHIP_TIERS[membership?.tier] ? membership.tier : 'free';
}

export function membershipPlan(membership) {
  return MEMBERSHIP_TIERS[activeTier(membership)];
}

export function hasPremium(membership, minimumTier = 'plus') {
  const order = ['free', 'plus', 'pro', 'master'];
  return order.indexOf(activeTier(membership)) >= order.indexOf(minimumTier);
}

export function formatLimit(limit) {
  return limit === Infinity ? 'Không giới hạn' : String(limit);
}
