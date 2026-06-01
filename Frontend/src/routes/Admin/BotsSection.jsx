import React from 'react';
import { Bot, CalendarDays } from 'lucide-react';

export default function BotsSection({
  bots,
  events,
  botForms,
  eventForm,
  onSubmitBot,
  onUpdateBotForm,
  onSubmitEvent,
  onUpdateEventForm,
  onToggleBot,
  onToggleEvent
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span><Bot size={16} /> Noi dung Play Bot</span>
          <h2>Bot theo mua va su kien</h2>
        </div>
      </div>
      <div className="admin-content-grid">
        <form className="admin-editor-card" onSubmit={onSubmitBot}>
          <strong>Them 5 bot</strong>
          {botForms.map((botForm, index) => (
            <div className="admin-bot-batch-row" key={index}>
              <span>Bot {index + 1}</span>
              <input value={botForm.name} onChange={(event) => onUpdateBotForm(index, { name: event.target.value })} placeholder="Ten bot" />
              <input type="number" value={botForm.elo} onChange={(event) => onUpdateBotForm(index, { elo: event.target.value })} placeholder="Elo" />
              <input value={botForm.eventTag} onChange={(event) => onUpdateBotForm(index, { eventTag: event.target.value })} placeholder="Ma su kien" />
              <input value={botForm.avatarUrl} onChange={(event) => onUpdateBotForm(index, { avatarUrl: event.target.value })} placeholder="Avatar URL" />
              <textarea value={botForm.mood} onChange={(event) => onUpdateBotForm(index, { mood: event.target.value })} placeholder="Phong cach bot" />
              <textarea value={botForm.chat} onChange={(event) => onUpdateBotForm(index, { chat: event.target.value })} placeholder="Cau chat lobby" />
              <label className="admin-check"><input type="checkbox" checked={botForm.active} onChange={() => onUpdateBotForm(index, { active: !botForm.active })} /> Dang bat</label>
            </div>
          ))}
          <button><Bot size={16} /> Them 5 bot</button>
        </form>
        <form className="admin-editor-card" onSubmit={onSubmitEvent}>
          <strong>Tao su kien</strong>
          <input value={eventForm.title} onChange={(event) => onUpdateEventForm({ title: event.target.value })} placeholder="Ten su kien" />
          <input value={eventForm.eventType} onChange={(event) => onUpdateEventForm({ eventType: event.target.value })} placeholder="event_type" />
          <input value={eventForm.rewardLabel} onChange={(event) => onUpdateEventForm({ rewardLabel: event.target.value })} placeholder="Phan thuong" />
          <textarea value={eventForm.description} onChange={(event) => onUpdateEventForm({ description: event.target.value })} placeholder="Y tuong su kien" />
          <label className="admin-check"><input type="checkbox" checked={eventForm.active} onChange={() => onUpdateEventForm({ active: !eventForm.active })} /> Dang bat</label>
          <button><CalendarDays size={16} /> Tao su kien</button>
        </form>
      </div>
      <div className="admin-table-list">
        {bots.map((bot) => (
          <article className="admin-report-card" key={bot.id}>
            <div>
              <strong>{bot.name} ({bot.elo})</strong>
              <span>{bot.event_tag} | {bot.active ? 'dang hien' : 'dang an'} | {bot.mood}</span>
              <small>{bot.chat}</small>
            </div>
            <div>
              <button onClick={() => onToggleBot(bot)}>{bot.active ? 'An' : 'Hien'}</button>
            </div>
          </article>
        ))}
        {events.map((item) => (
          <article className="admin-report-card" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.event_type} | {item.active ? 'dang chay' : 'tam dung'} | Thuong: {item.reward_label}</span>
              <small>{item.description}</small>
            </div>
            <div>
              <button onClick={() => onToggleEvent(item)}>{item.active ? 'Tam dung' : 'Mo lai'}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
