import React from 'react';
import { Bot, CalendarDays, Pencil, Save, Search, X } from 'lucide-react';
import Pagination from '../../components/Pagination';

function botToForm(bot) {
  return {
    name: bot.name || '',
    elo: bot.elo || 1200,
    eventTag: bot.event_tag || 'seasonal',
    avatarUrl: bot.avatar_url || '/chessarena-mark.svg',
    mood: bot.mood || '',
    chat: bot.chat || '',
    sortOrder: bot.sort_order ?? 50,
    active: bot.active !== false
  };
}

function eventToForm(item) {
  return {
    title: item.title || '',
    eventType: item.event_type || 'bot_challenge',
    rewardLabel: item.reward_label || '',
    description: item.description || '',
    active: item.active !== false
  };
}

export default function BotsSection({
  bots,
  events,
  botsPage,
  botsTotalPages,
  eventsPage,
  eventsTotalPages,
  botForms,
  eventForm,
  onBotsPageChange,
  onEventsPageChange,
  onSubmitBot,
  onUpdateBotForm,
  onSubmitEvent,
  onUpdateEventForm,
  onSaveBot,
  onSaveEvent,
  onToggleBot,
  onToggleEvent
}) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [editingBotId, setEditingBotId] = React.useState('');
  const [editingBotForm, setEditingBotForm] = React.useState(null);
  const [editingEventId, setEditingEventId] = React.useState('');
  const [editingEventForm, setEditingEventForm] = React.useState(null);
  const [savingId, setSavingId] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...values) => !normalizedQuery || values.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
  const matchesStatus = (item) => status === 'all' || (status === 'active' ? item.active !== false : item.active === false);
  const visibleBots = bots.filter((bot) => matchesStatus(bot) && matchesQuery(bot.name, bot.event_tag, bot.mood, bot.chat));
  const visibleEvents = events.filter((item) => matchesStatus(item) && matchesQuery(item.title, item.event_type, item.reward_label, item.description));

  const startEditBot = (bot) => {
    setEditingEventId('');
    setEditingEventForm(null);
    setEditingBotId(bot.id);
    setEditingBotForm(botToForm(bot));
  };

  const startEditEvent = (item) => {
    setEditingBotId('');
    setEditingBotForm(null);
    setEditingEventId(item.id);
    setEditingEventForm(eventToForm(item));
  };

  const saveEditingBot = async () => {
    if (!editingBotId || !editingBotForm) return;
    setSavingId(editingBotId);
    try {
      await onSaveBot(editingBotId, editingBotForm);
      setEditingBotId('');
      setEditingBotForm(null);
    } finally {
      setSavingId('');
    }
  };

  const saveEditingEvent = async () => {
    if (!editingEventId || !editingEventForm) return;
    setSavingId(editingEventId);
    try {
      await onSaveEvent(editingEventId, editingEventForm);
      setEditingEventId('');
      setEditingEventForm(null);
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span><Bot size={16} /> Nội dung Play Bot</span>
          <h2>Bot theo mùa và sự kiện</h2>
        </div>
      </div>
      <div className="admin-content-grid">
        <form className="admin-editor-card admin-bot-builder" onSubmit={onSubmitBot}>
          <div className="admin-editor-title">
            <div>
              <span>Thêm nhanh</span>
              <strong>Tạo 5 bot mới</strong>
            </div>
            <small>Điền đủ bot cần tạo, các dòng trống sẽ được backend bỏ qua nếu không hợp lệ.</small>
          </div>
          {botForms.map((botForm, index) => (
            <div className="admin-bot-batch-row" key={index}>
              <div className="admin-bot-row-head">
                <img src={botForm.avatarUrl || '/chessarena-mark.svg'} alt="" />
                <div>
                  <span>Bot {index + 1}</span>
                  <strong>{botForm.name || 'Bot chưa đặt tên'}</strong>
                </div>
                <label className="admin-check"><input type="checkbox" checked={botForm.active} onChange={() => onUpdateBotForm(index, { active: !botForm.active })} /> Đang bật</label>
              </div>
              <label>Tên bot
                <input value={botForm.name} onChange={(event) => onUpdateBotForm(index, { name: event.target.value })} placeholder="Ví dụ: Lá Chắn Mùa Xuân" />
              </label>
              <label>Elo
                <input type="number" value={botForm.elo} onChange={(event) => onUpdateBotForm(index, { elo: event.target.value })} placeholder="1200" />
              </label>
              <label>Mã sự kiện
                <input value={botForm.eventTag} onChange={(event) => onUpdateBotForm(index, { eventTag: event.target.value })} placeholder="seasonal" />
              </label>
              <label>Thứ tự
                <input type="number" value={botForm.sortOrder} onChange={(event) => onUpdateBotForm(index, { sortOrder: event.target.value })} placeholder="50" />
              </label>
              <label>Avatar URL
                <input value={botForm.avatarUrl} onChange={(event) => onUpdateBotForm(index, { avatarUrl: event.target.value })} placeholder="/chessarena-mark.svg" />
              </label>
              <label>Phong cách bot
                <textarea value={botForm.mood} onChange={(event) => onUpdateBotForm(index, { mood: event.target.value })} placeholder="Mô tả tính cách, độ khó, phong cách chơi..." />
              </label>
              <label>Câu chat lobby
                <textarea value={botForm.chat} onChange={(event) => onUpdateBotForm(index, { chat: event.target.value })} placeholder="Lời chào bot nói với người chơi..." />
              </label>
            </div>
          ))}
          <button><Bot size={16} /> Thêm 5 bot</button>
        </form>
        <form className="admin-editor-card admin-event-builder" onSubmit={onSubmitEvent}>
          <div className="admin-editor-title">
            <div>
              <span>Sự kiện</span>
              <strong>Tạo sự kiện bot</strong>
            </div>
            <small>Dùng mã sự kiện giống `eventTag` để gom bot theo chiến dịch.</small>
          </div>
          <label>Tên sự kiện
            <input value={eventForm.title} onChange={(event) => onUpdateEventForm({ title: event.target.value })} placeholder="Thử thách mùa hè" />
          </label>
          <label>Loại sự kiện
            <input value={eventForm.eventType} onChange={(event) => onUpdateEventForm({ eventType: event.target.value })} placeholder="bot_challenge" />
          </label>
          <label>Phần thưởng
            <input value={eventForm.rewardLabel} onChange={(event) => onUpdateEventForm({ rewardLabel: event.target.value })} placeholder="Huy hiệu mùa" />
          </label>
          <label>Ý tưởng sự kiện
            <textarea value={eventForm.description} onChange={(event) => onUpdateEventForm({ description: event.target.value })} placeholder="Mô tả mục tiêu, cách nhận thưởng và thời gian diễn ra..." />
          </label>
          <label className="admin-check"><input type="checkbox" checked={eventForm.active} onChange={() => onUpdateEventForm({ active: !eventForm.active })} /> Đang bật</label>
          <button><CalendarDays size={16} /> Tạo sự kiện</button>
        </form>
      </div>
      <div className="admin-list-toolbar">
        <label>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bot, sự kiện, mã tag..." />
        </label>
        <div>
          <button type="button" className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Tất cả</button>
          <button type="button" className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>Đang bật</button>
          <button type="button" className={status === 'hidden' ? 'active' : ''} onClick={() => setStatus('hidden')}>Đang ẩn</button>
        </div>
      </div>
      <div className="admin-table-list">
        <div className="admin-list-subhead">
          <strong>Danh sách bot</strong>
          <span>Trang {botsPage} / {botsTotalPages}</span>
        </div>
        {visibleBots.map((bot) => (
          <article className="admin-report-card admin-bot-card" key={bot.id}>
            <img className="admin-bot-avatar" src={bot.avatar_url || '/chessarena-mark.svg'} alt="" />
            {editingBotId === bot.id && editingBotForm ? (
              <div className="admin-inline-editor">
                <label>Tên bot <input value={editingBotForm.name} onChange={(event) => setEditingBotForm((form) => ({ ...form, name: event.target.value }))} /></label>
                <label>Elo <input type="number" value={editingBotForm.elo} onChange={(event) => setEditingBotForm((form) => ({ ...form, elo: event.target.value }))} /></label>
                <label>Mã sự kiện <input value={editingBotForm.eventTag} onChange={(event) => setEditingBotForm((form) => ({ ...form, eventTag: event.target.value }))} /></label>
                <label>Thứ tự <input type="number" value={editingBotForm.sortOrder} onChange={(event) => setEditingBotForm((form) => ({ ...form, sortOrder: event.target.value }))} /></label>
                <label>Avatar URL <input value={editingBotForm.avatarUrl} onChange={(event) => setEditingBotForm((form) => ({ ...form, avatarUrl: event.target.value }))} /></label>
                <label>Phong cách <textarea value={editingBotForm.mood} onChange={(event) => setEditingBotForm((form) => ({ ...form, mood: event.target.value }))} /></label>
                <label>Câu chat <textarea value={editingBotForm.chat} onChange={(event) => setEditingBotForm((form) => ({ ...form, chat: event.target.value }))} /></label>
                <label className="admin-check"><input type="checkbox" checked={editingBotForm.active} onChange={() => setEditingBotForm((form) => ({ ...form, active: !form.active }))} /> Đang bật</label>
                <div className="admin-inline-editor-actions">
                  <button type="button" onClick={saveEditingBot} disabled={savingId === bot.id}><Save size={16} /> {savingId === bot.id ? 'Đang lưu' : 'Lưu bot'}</button>
                  <button type="button" onClick={() => { setEditingBotId(''); setEditingBotForm(null); }}><X size={16} /> Hủy</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{bot.name} ({bot.elo})</strong>
                  <span>{bot.event_tag} | thứ tự {bot.sort_order ?? 50} | {bot.active ? 'đang hiện' : 'đang ẩn'} | {bot.mood}</span>
                  <small>{bot.chat}</small>
                </div>
                <div>
                  <button type="button" onClick={() => startEditBot(bot)}><Pencil size={16} /> Sửa</button>
                  <button type="button" onClick={() => onToggleBot(bot)}>{bot.active ? 'Ẩn' : 'Hiện'}</button>
                </div>
              </>
            )}
          </article>
        ))}
        <Pagination
          page={botsPage}
          totalPages={botsTotalPages}
          onPageChange={onBotsPageChange}
          label="Phân trang bot"
        />
        <div className="admin-list-subhead">
          <strong>Sự kiện bot</strong>
          <span>Trang {eventsPage} / {eventsTotalPages}</span>
        </div>
        {visibleEvents.map((item) => (
          <article className="admin-report-card" key={item.id}>
            {editingEventId === item.id && editingEventForm ? (
              <div className="admin-inline-editor admin-inline-editor-wide">
                <label>Tên sự kiện <input value={editingEventForm.title} onChange={(event) => setEditingEventForm((form) => ({ ...form, title: event.target.value }))} /></label>
                <label>Loại sự kiện <input value={editingEventForm.eventType} onChange={(event) => setEditingEventForm((form) => ({ ...form, eventType: event.target.value }))} /></label>
                <label>Phần thưởng <input value={editingEventForm.rewardLabel} onChange={(event) => setEditingEventForm((form) => ({ ...form, rewardLabel: event.target.value }))} /></label>
                <label>Mô tả <textarea value={editingEventForm.description} onChange={(event) => setEditingEventForm((form) => ({ ...form, description: event.target.value }))} /></label>
                <label className="admin-check"><input type="checkbox" checked={editingEventForm.active} onChange={() => setEditingEventForm((form) => ({ ...form, active: !form.active }))} /> Đang bật</label>
                <div className="admin-inline-editor-actions">
                  <button type="button" onClick={saveEditingEvent} disabled={savingId === item.id}><Save size={16} /> {savingId === item.id ? 'Đang lưu' : 'Lưu sự kiện'}</button>
                  <button type="button" onClick={() => { setEditingEventId(''); setEditingEventForm(null); }}><X size={16} /> Hủy</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.event_type} | {item.active ? 'đang chạy' : 'tạm dừng'} | Thưởng: {item.reward_label}</span>
                  <small>{item.description}</small>
                </div>
                <div>
                  <button type="button" onClick={() => startEditEvent(item)}><Pencil size={16} /> Sửa</button>
                  <button type="button" onClick={() => onToggleEvent(item)}>{item.active ? 'Tạm dừng' : 'Mở lại'}</button>
                </div>
              </>
            )}
          </article>
        ))}
        {visibleBots.length === 0 && visibleEvents.length === 0 && <p className="admin-message">Không tìm thấy bot hoặc sự kiện phù hợp.</p>}
        <Pagination
          page={eventsPage}
          totalPages={eventsTotalPages}
          onPageChange={onEventsPageChange}
          label="Phân trang sự kiện bot"
        />
      </div>
    </section>
  );
}
