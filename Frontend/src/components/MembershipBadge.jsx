import React from 'react';
import { Crown, Gem, Sparkles } from 'lucide-react';
import { membershipPlan } from '../membership/plans';

const BADGES = {
  plus: { icon: Sparkles, label: 'Plus' },
  pro: { icon: Crown, label: 'Pro' },
  master: { icon: Gem, label: 'Master' }
};

export default function MembershipBadge({ membership, tier, compact = false }) {
  const resolvedTier = tier || membershipPlan(membership).id;
  const badge = BADGES[resolvedTier];
  if (!badge) return null;

  const Icon = badge.icon;
  return (
    <span className={`membership-emblem ${resolvedTier} ${compact ? 'compact' : ''}`} title={`ChessArena ${badge.label}`}>
      <Icon size={compact ? 12 : 15} strokeWidth={2.4} />
      {!compact && <b>{badge.label}</b>}
    </span>
  );
}
