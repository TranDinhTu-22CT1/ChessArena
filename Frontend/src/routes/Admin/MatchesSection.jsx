import React from 'react';
import { gameModeLabel, gameStatusLabel, resultLabel, time } from './adminUtils';

export default function MatchesSection({ matches }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Quan ly tran dau</span>
          <h2>Cac tran online gan day</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {matches.map((match) => (
          <article className="admin-report-card" key={match.id}>
            <div>
              <strong>{match.white_name || 'Trang'} dau voi {match.black_name || 'Den'}</strong>
              <span>
                Trang thai: {gameStatusLabel(match.status)}
                {' | '}Ket qua: {resultLabel(match.result)}
                {' | '}Che do: {gameModeLabel(match.mode)}
                {' | '}Thoi gian: {match.time_control || '--'}
                {' | '}So nuoc: {match.moveCount ?? 0}
              </span>
              <small>Ma tran: {match.id} | Tao luc: {time(match.created_at)} | Cap nhat: {time(match.updated_at)}</small>
              <em>Nuoc cuoi: {(match.lastMoves || []).map((move) => move.san).join(' ') || 'Chua co nuoc di'}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
