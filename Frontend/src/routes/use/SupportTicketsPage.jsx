import React from 'react';
import Modal from '../../components/Modal';
import '../../styles/support-center.css';
import { FileImage, FileVideo, LifeBuoy, LogIn, Paperclip, RefreshCw, Send, X } from 'lucide-react';
import { fetchMySupportRequests, fetchSupportMessages, sendSupportMessage } from '../../api/support';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const STATUS_LABELS = {
  new: 'Mới',
  in_review: 'Đang xử lý',
  waiting_user: 'Chờ bạn phản hồi',
  resolved: 'Đã giải quyết',
  dismissed: 'Đã đóng'
};

const CATEGORY_LABELS = {
  account: 'Tài khoản',
  billing: 'Thanh toán',
  online: 'Online',
  moderation: 'Báo cáo',
  puzzle: 'Puzzle',
  technical: 'Kỹ thuật',
  general: 'Khác'
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function readAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = () => reject(new Error(`Không thể đọc ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({ attachment, removable = false, onRemove }) {
  const source = attachment?.url || attachment?.dataUrl;
  const isImage = String(attachment?.mimeType || '').startsWith('image/');
  const isVideo = String(attachment?.mimeType || '').startsWith('video/');
  return (
    <div className="support-ticket-attachment-wrap">
      <a className="support-ticket-attachment" href={source} target="_blank" rel="noreferrer">
        {isImage && <img src={source} alt={attachment.name || 'Ảnh đính kèm'} />}
        {isVideo && <video src={source} muted controls preload="metadata" />}
        {!isImage && !isVideo && <FileImage size={20} />}
        <span>{isImage ? <FileImage size={14} /> : <FileVideo size={14} />} {attachment.name || 'File đính kèm'}</span>
      </a>
      {removable && (
        <button type="button" className="support-attachment-remove" onClick={onRemove} aria-label="Xóa tệp">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function TicketThreadModal({ ticket, onClose, onTicketUpdated }) {
  const [currentTicket, setCurrentTicket] = React.useState(ticket);
  const [thread, setThread] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const sendingRef = React.useRef(false);
  const [readingFiles, setReadingFiles] = React.useState(false);

  React.useEffect(() => setCurrentTicket(ticket), [ticket]);

  const loadThread = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSupportMessages(ticket.id);
      if (data.ticket) setCurrentTicket((current) => ({ ...current, ...data.ticket }));
      setThread(data.messages || []);
      setEvents(data.events || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải hội thoại.');
    } finally {
      setLoading(false);
    }
  }, [ticket.id]);

  React.useEffect(() => {
    loadThread();
  }, [loadThread]);

  const selectFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 4 - attachments.length));
    event.target.value = '';
    if (files.some(file => !/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime))$/.test(file.type) || file.size > 10 * 1024 * 1024)) {
      setError('Chọn ảnh hoặc video hợp lệ, tối đa 10 MB mỗi tệp.');
      return;
    }
    setReadingFiles(true);
    try {
      const next = await Promise.all(files.map(readAttachment));
      setAttachments((current) => [...current, ...next].slice(0, 4));
    } catch (fileError) {
      setError(fileError.message);
    } finally { setReadingFiles(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sendingRef.current || readingFiles || (!body.trim() && attachments.length === 0)) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      await sendSupportMessage(ticket.id, { body: body.trim(), attachments });
      setBody('');
      setAttachments([]);
      await loadThread();
      onTicketUpdated?.();
    } catch (sendError) {
      setError(sendError.message || 'Không thể gửi phản hồi.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const closed = ['resolved', 'dismissed'].includes(currentTicket.status);

  return (
    <Modal open onClose={onClose} className="surface-dialog support-conversation-dialog" aria-label="Trao đổi hỗ trợ">
      <section className="admin-modal support-ticket-modal support-thread-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="support-ticket-modal-head">
          <div>
            <span className={`support-category ${currentTicket.category}`}>{CATEGORY_LABELS[currentTicket.category] || currentTicket.category}</span>
            <span className={`support-status ${currentTicket.status}`}>{STATUS_LABELS[currentTicket.status] || currentTicket.status}</span>
            <h2>{currentTicket.subject || 'Yêu cầu hỗ trợ'}</h2>
            <small>Mã yêu cầu #{String(currentTicket.id).slice(0, 8)}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>

        <div className="support-ticket-modal-body">
          <div className="support-ticket-meta">
            <small>Tạo lúc: {formatDate(currentTicket.createdAt || currentTicket.created_at)}</small>
            <small>Cập nhật: {formatDate(currentTicket.updatedAt || currentTicket.updated_at)}</small>
          </div>
          <section className="support-ticket-section">
            <strong>Nội dung</strong>
            {currentTicket.message ? <p>{currentTicket.message}</p> : <p className="support-ticket-empty-line">Không có nội dung.</p>}
          </section>

          <section className="support-ticket-section">
            <strong>Ảnh / tệp đính kèm</strong>
            {currentTicket.attachments?.length > 0 ? (
              <div className="support-ticket-media-grid">
                {currentTicket.attachments.map((attachment) => (
                  <AttachmentPreview attachment={attachment} key={attachment.id || attachment.name} />
                ))}
              </div>
            ) : (
              <p className="support-ticket-empty-line">Không có ảnh.</p>
            )}
          </section>

        <div className={`support-thread-list ${!loading && thread.length === 0 ? 'empty' : ''}`}>
          {loading && <p className="support-faq-empty">Đang tải hội thoại...</p>}
          {!loading && thread.length === 0 && <p className="support-ticket-empty-line">Không có nội dung hội thoại.</p>}
          {!loading && thread.map((message) => (
            <article className={`support-thread-message ${message.senderType === 'admin' ? 'admin' : 'user'}`} key={message.id}>
              <strong>{message.senderType === 'admin' ? 'Hỗ trợ ChessArena' : 'Bạn'}</strong>
              {message.body && <p>{message.body}</p>}
              {message.attachments?.length > 0 && (
                <div className="support-ticket-media-grid">
                  {message.attachments.map((attachment) => (
                    <AttachmentPreview attachment={attachment} key={attachment.id || attachment.name} />
                  ))}
                </div>
              )}
              <small>{formatDate(message.createdAt)}</small>
            </article>
          ))}
          {error && <p className="support-form-error">{error}</p>}
        </div>
        {events.length > 0 && (
          <section className="support-ticket-section support-status-history">
            <strong>Lịch sử trạng thái</strong>
            {events.map((event) => (
              <p key={event.id}><span>{STATUS_LABELS[event.old_status] || event.old_status || 'Mới'} → {STATUS_LABELS[event.new_status] || event.new_status}</span><small>{formatDate(event.created_at)}</small></p>
            ))}
          </section>
        )}
        </div>

        {!closed ? (
          <form className="support-thread-composer" onSubmit={submit}>
            <textarea
              value={body}
              disabled={sending}
              aria-label="Nội dung phản hồi"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Nhập nội dung phản hồi..."
              rows={4}
              maxLength={4000}
            />
            {attachments.length > 0 && (
              <div className="support-ticket-media-grid">
                {attachments.map((attachment) => (
                  <AttachmentPreview
                    attachment={attachment}
                    removable
                    onRemove={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    key={attachment.id}
                  />
                ))}
              </div>
            )}
            <div className="support-thread-actions">
              <label className="support-file-button">
                <Paperclip size={17} />
                <span>Ảnh hoặc video</span>
                <input type="file" accept="image/*,video/*" multiple disabled={sending || readingFiles} onChange={selectFiles} />
              </label>
              <button type="submit" disabled={sending || readingFiles || (!body.trim() && attachments.length === 0)}>
                <Send size={17} /> {sending ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          </form>
        ) : (
          <p className="support-ticket-closed">Yêu cầu này đã đóng. Hãy tạo yêu cầu mới nếu bạn cần hỗ trợ thêm.</p>
        )}
      </section>
    </Modal>
  );
}

export default function SupportTicketsPage({ authUser, onLogin, onNavigate, embedded = false, selectedTicketId = '' }) {
  const [tickets, setTickets] = React.useState([]);
  const [selectedTicket, setSelectedTicket] = React.useState(null);
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async (nextPage = page) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchMySupportRequests({ page: nextPage, limit: 8 });
      const nextTickets = data.requests || [];
      setTickets(nextTickets);
      if (selectedTicketId) setSelectedTicket(nextTickets.find((ticket) => ticket.id === selectedTicketId) || null);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setMessage(error.message || 'Không thể tải yêu cầu hỗ trợ.');
    } finally {
      setLoading(false);
    }
  }, [authUser, page, selectedTicketId]);

  React.useEffect(() => {
    load(page);
  }, [load, page]);

  const changePage = (nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
  };

  if (!authUser) {
    return (
      <section className="support-page support-tickets-page">
        <div className="support-auth-note">
          <LifeBuoy size={22} />
          <span>Đăng nhập để xem trạng thái yêu cầu hỗ trợ của bạn.</span>
          <button type="button" onClick={onLogin}><LogIn size={17} /> Đăng nhập</button>
        </div>
      </section>
    );
  }

  const Root = embedded ? 'section' : 'main';
  return (
    <Root className={`support-page support-tickets-page ${embedded ? 'embedded' : ''}`}>
      <section className="support-hero">
        <div>
          <span><LifeBuoy size={16} /> HỘP THƯ HỖ TRỢ</span>
          <h1>Theo dõi hỗ trợ</h1>
          <p>Xem tiến độ và trao đổi trực tiếp với bộ phận hỗ trợ.</p>
        </div>
        <div className="support-hero-actions">
          <button type="button" onClick={() => onNavigate?.('support')}>Gửi yêu cầu mới</button>
          <button type="button" onClick={() => load(page)} disabled={loading}><RefreshCw size={16} /> Tải lại</button>
        </div>
      </section>

      {loading && <p className="support-faq-empty" role="status">Đang tải yêu cầu của bạn…</p>}{message && <p className="support-faq-empty" role="alert">{message}</p>}
      {!loading && tickets.length === 0 && <p className="support-faq-empty">Bạn chưa có yêu cầu hỗ trợ nào.</p>}

      <section className="support-ticket-timeline">
        {tickets.map((ticket) => (
          <button type="button" className="support-user-ticket" key={ticket.id} onClick={() => setSelectedTicket(ticket)}>
            <div className="support-card-topline">
              <span className={`support-category ${ticket.category}`}>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
              <span className={`support-status ${ticket.status}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
            </div>
            <h2>{ticket.subject || 'Yêu cầu hỗ trợ'}</h2>
            <p>{ticket.message}</p>
            <small>Mã yêu cầu #{String(ticket.id).slice(0, 8)} - gửi lúc {formatDate(ticket.createdAt)}</small>
            {ticket.attachments?.length > 0 && <small>{ticket.attachments.length} tệp đính kèm</small>}
          </button>
        ))}
      </section>

      <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Phân trang yêu cầu hỗ trợ" />

      {selectedTicket && (
        <TicketThreadModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onTicketUpdated={() => load(page)}
        />
      )}
    </Root>
  );
}
