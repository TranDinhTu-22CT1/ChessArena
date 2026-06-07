import React from 'react';
import { UserRound } from 'lucide-react';
import MembershipBadge from './MembershipBadge';

export default function PlayerCard({ tone, name, label, clock, captures, avatarURL, membership, materialLead = 0, active }) {
  return (
    <section className={`player-card ${tone} ${active ? 'active' : ''}`}>
      <div className="avatar">
        {avatarURL ? <img src={avatarURL} alt="" /> : <UserRound size={20} />}
      </div>
      <div className="player-main">
        <div>
          <p>{label}</p>
          <div className="player-name-with-badge">
            <h2>{name}</h2>
            <MembershipBadge membership={membership} compact />
          </div>
        </div>
        <div className="captures">
          {captures.map((piece, index) => (
            <img src={piece.src} alt={piece.alt} key={`${piece.alt}-${index}`} draggable="false" />
          ))}
          {materialLead > 0 && <span className="material-lead">+{materialLead}</span>}
        </div>
      </div>
      <div className="clock">{clock}</div>
    </section>
  );
}
