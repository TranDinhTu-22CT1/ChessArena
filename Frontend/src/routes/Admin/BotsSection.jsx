import React from 'react';
import { createPortal } from 'react-dom';
import { Bot, CalendarDays, Pencil, Save, Search, X } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';

const BOT_AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const BOT_AVATAR_EDGE = 160;

function resizedBotAvatarData(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectURL = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = BOT_AVATAR_EDGE;
      canvas.height = BOT_AVATAR_EDGE;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectURL);
        reject(new Error('Không thể xử lý ảnh bot.'));
        return;
      }
      const crop = Math.min(image.naturalWidth, image.naturalHeight);
      const left = (image.naturalWidth - crop) / 2;
      const top = (image.naturalHeight - crop) / 2;
      context.drawImage(image, left, top, crop, crop, 0, 0, BOT_AVATAR_EDGE, BOT_AVATAR_EDGE);
      URL.revokeObjectURL(objectURL);
      resolve(canvas.toDataURL('image/webp', 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('Không thể đọc ảnh bot đã chọn.'));
    };
    image.src = objectURL;
  });
}

async function readBotAvatarFile(file) {
  if (!file) return '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Chọn ảnh bot dạng PNG, JPG hoặc WebP.');
  }
  if (file.size > BOT_AVATAR_MAX_SIZE) {
    throw new Error('Ảnh bot tối đa 5 MB.');
  }
  return resizedBotAvatarData(file);
}

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
  loading = false,
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
  onDeleteBot,
  onDeleteBotGroup,
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
  const [showBatchDetails, setShowBatchDetails] = React.useState(false);
  const [selectedBotGroup, setSelectedBotGroup] = React.useState(null);
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...values) => !normalizedQuery || values.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
  const matchesStatus = (item) => status === 'all' || (status === 'active' ? item.active !== false : item.active === false);
  const visibleBots = bots.filter((bot) => matchesStatus(bot) && matchesQuery(bot.name, bot.event_tag, bot.mood, bot.chat));
  const batchTag = botForms[0]?.eventTag || '';
  const visibleEvents = events.filter(() => false);
  const filledBatchBots = botForms.filter((botForm) => String(botForm.name || '').trim()).length;
  const botGroups = Object.values(visibleBots.reduce((groups, bot) => {
    const key = bot.event_tag || 'ungrouped';
    if (!groups[key]) groups[key] = { eventTag: key, bots: [] };
    groups[key].bots.push(bot);
    return groups;
  }, {})).map((group) => ({
    ...group,
    bots: group.bots.sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0))
  }));
  const selectedGroup = selectedBotGroup
    ? botGroups.find((group) => group.eventTag === selectedBotGroup) || null
    : null;

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

  const deleteEditingBot = async (bot) => {
    if (!window.confirm(`Xóa bot "${bot.name}" khỏi Supabase?`)) return;
    setSavingId(bot.id);
    try {
      await onDeleteBot(bot.id);
      setEditingBotId('');
      setEditingBotForm(null);
    } finally {
      setSavingId('');
    }
  };

  const deleteSelectedGroup = async (group) => {
    if (!window.confirm(`Xóa cả thẻ "${group.eventTag}" với ${group.bots.length} bot khỏi Supabase?`)) return;
    setSavingId(group.eventTag);
    try {
      await onDeleteBotGroup(group.eventTag);
      setSelectedBotGroup(null);
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

  const selectBatchAvatar = async (index, file) => {
    const avatarUrl = await readBotAvatarFile(file);
    if (avatarUrl) onUpdateBotForm(index, { avatarUrl });
  };

  const selectEditingAvatar = async (file) => {
    const avatarUrl = await readBotAvatarFile(file);
    if (avatarUrl) setEditingBotForm((form) => ({ ...form, avatarUrl }));
  };

  const clearBatchBot = (index) => {
    onUpdateBotForm(index, {
      name: '',
      elo: 1200,
      eventTag: 'seasonal',
      avatarUrl: '/chessarena-mark.svg',
      mood: '',
      chat: '',
      sortOrder: 50 + index,
      active: false
    });
  };

  const updateBatchTag = (eventTag) => {
    botForms.forEach((_, index) => onUpdateBotForm(index, { eventTag }));
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span><Bot size={16} /> Nội dung Play Bot</span>
          <h2>Bot theo thẻ</h2>
        </div>
      </div>
      <div className="admin-content-grid admin-content-grid-single">
        <form id="admin-bot-builder-form" className="admin-editor-card admin-bot-builder" onSubmit={onSubmitBot}>
          <div className="admin-editor-title">
            <div>
              <span>Thêm nhanh</span>
              <strong>Tạo 5 bot mới</strong>
            </div>
            <small>Điền đủ bot cần tạo, các dòng trống sẽ được backend bỏ qua nếu không hợp lệ.</small>
          </div>
          <label className="admin-tag-name-field">Tên thẻ
            <input value={batchTag} onChange={(event) => updateBatchTag(event.target.value)} placeholder="Ví dụ: spring-challenge" />
          </label>
          <div className="admin-bot-create-summary">
            <div className="admin-bot-summary-avatars" aria-hidden="true">
              {botForms.map((botForm, index) => (
                <img key={index} src={botForm.avatarUrl || '/chessarena-mark.svg'} alt="" />
              ))}
            </div>
            <div>
              <strong>{filledBatchBots}/5 bot đã có tên</strong>
              <span>Chỉnh từng bot trong popup riêng để form không bị chen cột ảnh, phong cách và câu chat.</span>
            </div>
            <button type="button" onClick={() => setShowBatchDetails(true)}>
              <Pencil size={16} /> Xem chi tiết 5 bot
            </button>
          </div>

          {showBatchDetails && createPortal((
            <div className="admin-modal-layer admin-bot-detail-layer" role="dialog" aria-modal="true" onMouseDown={() => setShowBatchDetails(false)}>
              <section className="admin-modal admin-bot-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
                <div className="admin-bot-detail-head">
                  <div>
                    <span>Tạo nhanh 5 bot</span>
                    <h3>Chi tiết bot theo thẻ</h3>
                    <p>Chỉ cần điền các bot muốn tạo. Dòng trống hoặc không hợp lệ sẽ được backend bỏ qua.</p>
                  </div>
                  <button type="button" onClick={() => setShowBatchDetails(false)} aria-label="Đóng">
                    <X size={20} />
                  </button>
                </div>

                <div className="admin-bot-detail-list">
                  {botForms.map((botForm, index) => (
                    <div className="admin-bot-batch-row admin-bot-batch-row-modal" key={index}>
                      <div className="admin-bot-row-head">
                        <img src={botForm.avatarUrl || '/chessarena-mark.svg'} alt="" />
                        <div>
                          <span>Bot {index + 1}</span>
                          <strong>{botForm.name || 'Bot chưa đặt tên'}</strong>
                        </div>
                        <label className="admin-check"><input type="checkbox" checked={botForm.active} onChange={() => onUpdateBotForm(index, { active: !botForm.active })} /> Đang bật</label>
                        <button className="admin-bot-row-delete" type="button" onClick={() => clearBatchBot(index)}>
                          <X size={15} /> Xóa
                        </button>
                      </div>
                      <label>Tên bot
                        <input value={botForm.name} onChange={(event) => onUpdateBotForm(index, { name: event.target.value })} placeholder="Ví dụ: Lá Chắn Mùa Xuân" />
                      </label>
                      <label>Elo
                        <input type="number" value={botForm.elo} onChange={(event) => onUpdateBotForm(index, { elo: event.target.value })} placeholder="1200" />
                      </label>
                      <label>Tên thẻ
                        <input value={botForm.eventTag} onChange={(event) => onUpdateBotForm(index, { eventTag: event.target.value })} placeholder="seasonal" />
                      </label>
                      <label>Thứ tự
                        <input type="number" value={botForm.sortOrder} onChange={(event) => onUpdateBotForm(index, { sortOrder: event.target.value })} placeholder="50" />
                      </label>
                      <label>Avatar URL
                        <input value={botForm.avatarUrl} onChange={(event) => onUpdateBotForm(index, { avatarUrl: event.target.value })} placeholder="/chessarena-mark.svg" />
                      </label>
                      <label>Ảnh từ máy
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectBatchAvatar(index, event.target.files?.[0]).catch((error) => window.alert(error.message))} />
                      </label>
                      <label>Phong cách bot
                        <textarea value={botForm.mood} onChange={(event) => onUpdateBotForm(index, { mood: event.target.value })} placeholder="Mô tả tính cách, độ khó và phong cách chơi..." />
                      </label>
                      <label>Câu chat lobby
                        <textarea value={botForm.chat} onChange={(event) => onUpdateBotForm(index, { chat: event.target.value })} placeholder="Lời chào bot nói với người chơi..." />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="admin-bot-detail-actions">
                  <button type="button" onClick={() => setShowBatchDetails(false)}>
                    <X size={16} /> Đóng
                  </button>
                  <button type="submit" form="admin-bot-builder-form" onClick={() => setShowBatchDetails(false)}>
                    <Bot size={16} /> Thêm 5 bot
                  </button>
                </div>
              </section>
            </div>
          ), document.body)}
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
              <label>Tên thẻ
                <input value={botForm.eventTag} onChange={(event) => onUpdateBotForm(index, { eventTag: event.target.value })} placeholder="seasonal" />
              </label>
              <label>Thứ tự
                <input type="number" value={botForm.sortOrder} onChange={(event) => onUpdateBotForm(index, { sortOrder: event.target.value })} placeholder="50" />
              </label>
              <label>Avatar URL
                <input value={botForm.avatarUrl} onChange={(event) => onUpdateBotForm(index, { avatarUrl: event.target.value })} placeholder="/chessarena-mark.svg" />
              </label>
              <label>Ảnh từ máy
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectBatchAvatar(index, event.target.files?.[0]).catch((error) => window.alert(error.message))} />
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bot hoặc tên thẻ..." />
        </label>
        <div>
          <button type="button" className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Tất cả</button>
          <button type="button" className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>Đang bật</button>
          <button type="button" className={status === 'hidden' ? 'active' : ''} onClick={() => setStatus('hidden')}>Đang ẩn</button>
        </div>
      </div>
      <div className="admin-table-list admin-bot-table-list">
        <div className="admin-list-subhead">
          <strong>Danh sách bot</strong>
          <span>Trang {botsPage} / {botsTotalPages}</span>
        </div>
        {loading && <LoadingBlock label="Đang tải danh sách thẻ bot" />}
        {botGroups.map((group) => {
          const activeCount = group.bots.filter((bot) => bot.active !== false).length;
          const elos = group.bots.map((bot) => Number(bot.elo || 0)).filter(Boolean);
          const minElo = elos.length ? Math.min(...elos) : 0;
          const maxElo = elos.length ? Math.max(...elos) : 0;
          return (
            <article
              className="admin-report-card admin-bot-group-card"
              key={group.eventTag}
              onClick={() => setSelectedBotGroup(group.eventTag)}
            >
              <div className="admin-bot-group-avatars">
                {group.bots.slice(0, 5).map((bot) => (
                  <img key={bot.id} src={bot.avatar_url || '/chessarena-mark.svg'} alt="" />
                ))}
              </div>
              <div>
                <strong>{group.eventTag}</strong>
                <span>{group.bots.length} bot | {activeCount} đang hiện | Elo {minElo === maxElo ? minElo : `${minElo}-${maxElo}`}</span>
                <small>{group.bots.map((bot) => `${bot.name} (${bot.elo})`).join(' - ')}</small>
              </div>
              <div>
                <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedBotGroup(group.eventTag); }}>
                  <Pencil size={16} /> Xem chi tiết
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); deleteSelectedGroup(group); }} disabled={savingId === group.eventTag}>
                  <X size={16} /> Xóa thẻ
                </button>
              </div>
            </article>
          );
        })}
        {[].map((bot) => (
          <article className="admin-report-card admin-bot-card" key={bot.id}>
            <img className="admin-bot-avatar" src={bot.avatar_url || '/chessarena-mark.svg'} alt="" />
            {editingBotId === bot.id && editingBotForm ? (
              <div className="admin-inline-editor">
                <label>Tên bot <input value={editingBotForm.name} onChange={(event) => setEditingBotForm((form) => ({ ...form, name: event.target.value }))} /></label>
                <label>Elo <input type="number" value={editingBotForm.elo} onChange={(event) => setEditingBotForm((form) => ({ ...form, elo: event.target.value }))} /></label>
                <label>Tên thẻ <input value={editingBotForm.eventTag} onChange={(event) => setEditingBotForm((form) => ({ ...form, eventTag: event.target.value }))} /></label>
                <label>Thứ tự <input type="number" value={editingBotForm.sortOrder} onChange={(event) => setEditingBotForm((form) => ({ ...form, sortOrder: event.target.value }))} /></label>
                <label>Avatar URL <input value={editingBotForm.avatarUrl} onChange={(event) => setEditingBotForm((form) => ({ ...form, avatarUrl: event.target.value }))} /></label>
                <label>Ảnh từ máy <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectEditingAvatar(event.target.files?.[0]).catch((error) => window.alert(error.message))} /></label>
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
        {selectedGroup && createPortal((
          <div className="admin-modal-layer admin-bot-detail-layer" role="dialog" aria-modal="true" onMouseDown={() => setSelectedBotGroup(null)}>
            <section className="admin-modal admin-bot-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="admin-bot-detail-head">
                <div>
                  <span>Thẻ bot</span>
                  <h3>{selectedGroup.eventTag}</h3>
                  <p>{selectedGroup.bots.length} bot trong thẻ này. Sửa thông tin sẽ cập nhật trực tiếp vào Supabase.</p>
                </div>
                <button type="button" onClick={() => setSelectedBotGroup(null)} aria-label="Đóng">
                  <X size={20} />
                </button>
              </div>

              <div className="admin-bot-group-modal-list">
                {selectedGroup.bots.map((bot) => (
                  <article className="admin-report-card admin-bot-card admin-bot-modal-card" key={bot.id}>
                    <img className="admin-bot-avatar" src={bot.avatar_url || '/chessarena-mark.svg'} alt="" />
                    {editingBotId === bot.id && editingBotForm ? (
                      <div className="admin-inline-editor">
                        <label>Tên bot <input value={editingBotForm.name} onChange={(event) => setEditingBotForm((form) => ({ ...form, name: event.target.value }))} /></label>
                        <label>Elo <input type="number" value={editingBotForm.elo} onChange={(event) => setEditingBotForm((form) => ({ ...form, elo: event.target.value }))} /></label>
                        <label>Tên thẻ <input value={editingBotForm.eventTag} onChange={(event) => setEditingBotForm((form) => ({ ...form, eventTag: event.target.value }))} /></label>
                        <label>Thứ tự <input type="number" value={editingBotForm.sortOrder} onChange={(event) => setEditingBotForm((form) => ({ ...form, sortOrder: event.target.value }))} /></label>
                        <label>Avatar URL <input value={editingBotForm.avatarUrl} onChange={(event) => setEditingBotForm((form) => ({ ...form, avatarUrl: event.target.value }))} /></label>
                        <label>Ảnh từ máy <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectEditingAvatar(event.target.files?.[0]).catch((error) => window.alert(error.message))} /></label>
                        <label>Phong cách <textarea value={editingBotForm.mood} onChange={(event) => setEditingBotForm((form) => ({ ...form, mood: event.target.value }))} /></label>
                        <label>Câu chat <textarea value={editingBotForm.chat} onChange={(event) => setEditingBotForm((form) => ({ ...form, chat: event.target.value }))} /></label>
                        <label className="admin-check"><input type="checkbox" checked={editingBotForm.active} onChange={() => setEditingBotForm((form) => ({ ...form, active: !form.active }))} /> Đang hiện</label>
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
                          <button type="button" onClick={() => deleteEditingBot(bot)} disabled={savingId === bot.id}><X size={16} /> Xóa</button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>

              <div className="admin-bot-detail-actions">
                <button type="button" onClick={() => setSelectedBotGroup(null)}><X size={16} /> Đóng</button>
                <button type="button" onClick={() => deleteSelectedGroup(selectedGroup)} disabled={savingId === selectedGroup.eventTag}>
                  <X size={16} /> Xóa cả thẻ
                </button>
              </div>
            </section>
          </div>
        ), document.body)}
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
        {!loading && visibleBots.length === 0 && visibleEvents.length === 0 && <p className="admin-message">Không tìm thấy bot hoặc thẻ phù hợp.</p>}
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
