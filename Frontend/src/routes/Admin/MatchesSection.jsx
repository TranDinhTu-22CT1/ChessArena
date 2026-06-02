import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { gameModeLabel, gameStatusLabel, resultLabel, time } from './adminUtils';

const TIME_CONTROLS = [
  ['180+0', 'Blitz 3+0'],
  ['300+0', 'Blitz 5+0'],
  ['600+0', 'Rapid 10+0'],
  ['900+10', 'Rapid 15+10']
];

function playerLabel(user) {
  return `${user.display_name || user.username || user.email || 'Player'} (${user.email || user.username || user.id})`;
}

function inviteUrl(code) {
  return `${window.location.origin}/play/online?invite=${encodeURIComponent(code)}`;
}

function previewColors(form, primary, opponent) {
  if (form.blackUserId && form.side === 'white') return { white: primary?.display_name, black: opponent?.display_name };
  if (form.blackUserId && form.side === 'black') return { white: opponent?.display_name, black: primary?.display_name };
  if (form.blackUserId) return { white: 'Random', black: 'Random' };
  if (form.side === 'black') return { white: 'TBD', black: primary?.display_name };
  return { white: primary?.display_name, black: 'TBD' };
}

export default function MatchesSection({ matches, users = [], form, onChangeForm, onSubmit }) {
  const selectedWhite = users.find((user) => user.id === form.whiteUserId);
  const selectedBlack = users.find((user) => user.id === form.blackUserId);
  const selectedSamePlayer = form.whiteUserId && form.blackUserId && form.whiteUserId === form.blackUserId;
  const preview = previewColors(form, selectedWhite, selectedBlack);

  const copyInvite = async (code) => {
    if (!code) return;
    await navigator.clipboard?.writeText(inviteUrl(code)).catch(() => {});
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Match control</span>
          <h2>Create and manage online matches</h2>
        </div>
      </div>

      <form className="admin-editor-card admin-match-create" onSubmit={onSubmit}>
        <div className="admin-editor-title">
          <div>
            <strong>Create admin match</strong>
            <small>Use one player to create an invite room, or two players to start the game immediately.</small>
          </div>
        </div>

        <label>
          Host / primary player
          <select
            required
            value={form.whiteUserId}
            onChange={(event) => onChangeForm({ whiteUserId: event.target.value })}
          >
            <option value="">Select player</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{playerLabel(user)}</option>
            ))}
          </select>
        </label>

        <label>
          Opponent (optional)
          <select
            value={form.blackUserId}
            onChange={(event) => onChangeForm({ blackUserId: event.target.value })}
          >
            <option value="">Create invite room</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{playerLabel(user)}</option>
            ))}
          </select>
        </label>

        <label>
          Side for primary player
          <select value={form.side} onChange={(event) => onChangeForm({ side: event.target.value })}>
            <option value="random">Random</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>

        <label>
          Time control
          <select value={form.timeControl} onChange={(event) => onChangeForm({ timeControl: event.target.value })}>
            {TIME_CONTROLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label>
          Match type
          <select value={form.matchType} onChange={(event) => onChangeForm({ matchType: event.target.value })}>
            <option value="friend">Friend / invite</option>
            <option value="quick">Quick match</option>
          </select>
        </label>

        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.rated}
            onChange={(event) => onChangeForm({ rated: event.target.checked })}
          />
          Rated match
        </label>

        <div className="admin-match-preview">
          <span>White: {preview.white || 'TBD'}</span>
          <span>Black: {preview.black || 'TBD'}</span>
          <span>{form.blackUserId ? 'Starts immediately' : 'Creates invite code'}</span>
        </div>

        {selectedSamePlayer && <p className="admin-message">Choose two different players.</p>}
        <button type="submit" disabled={selectedSamePlayer}>Create match</button>
      </form>

      <div className="admin-table-list">
        {matches.map((match) => (
          <article className="admin-report-card" key={match.id}>
            <div>
              <strong>{match.white_name || 'White'} vs {match.black_name || 'Black'}</strong>
              <span>
                Status: {gameStatusLabel(match.status)}
                {' | '}Result: {resultLabel(match.result)}
                {' | '}Mode: {gameModeLabel(match.mode)}
                {' | '}Time: {match.time_control || '--'}
                {' | '}{match.rated ? 'Rated' : 'Casual'}
                {' | '}Moves: {match.moveCount ?? 0}
              </span>
              <small>
                Game: {match.id}
                {' | '}Type: {match.match_type || '--'}
                {' | '}Created: {time(match.created_at)}
                {' | '}Updated: {time(match.updated_at)}
              </small>
              {match.invite_code && (
                <em className="admin-inline-actions">
                  Invite: {match.invite_code}
                  <button type="button" onClick={() => copyInvite(match.invite_code)}><Copy size={14} /> Copy link</button>
                  <button type="button" onClick={() => window.open(inviteUrl(match.invite_code), '_blank', 'noopener,noreferrer')}>
                    <ExternalLink size={14} /> Open
                  </button>
                </em>
              )}
              <em>Last moves: {(match.lastMoves || []).map((move) => move.san).join(' ') || 'No moves yet'}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
