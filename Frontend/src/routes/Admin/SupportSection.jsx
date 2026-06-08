import React from 'react';
import { createPortal } from 'react-dom';
import { FileImage, FileVideo, Paperclip, Send, X } from 'lucide-react';
import { fetchAdminSupportThread, sendAdminSupportMessage } from '../../api/admin';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { time } from './adminUtils';

const STATUS_LABELS = {
  new: 'Mới',
  in_review: 'Đang xử lý',
  waiting_user: 'Chờ người chơi',
  resolved: 'Đã giải quyết',
  dismissed: 'Đã đóng'
};

const CATEGORY_LABELS = {
  account: 'Tài khoản',
  billing: 'Thanh toán',
  online: 'Online',
  moderation: 'Báo cáo',
  puzzle: 'Puzzle',
  tournament: 'Giải đấu',
  technical: 'Kỹ thuật',
  general: 'Khác'
};

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

function AttachmentPreview({ attachment, removable = false, onRemove, onPreview }) {
  const source = attachment?.url || attachment?.dataUrl;
  const isImage = String(attachment?.mimeType || '').startsWith('image/');
  const isVideo = String(attachment?.mimeType || '').startsWith('video/');
  return (
    <div className="support-ticket-attachment-wrap">
      <button
        className="support-ticket-attachment"
        type="button"
        onClick={() => onPreview?.({ ...attachment, source, isImage, isVideo })}
      >
        {isImage && <img src={source} alt={attachment.name || 'Ảnh đính kèm'} />}
        {isVideo && <video src={source} controls preload="metadata" />}
        {!isImage && !isVideo && <FileImage size={22} />}
        <span>{isImage ? <FileImage size={14} /> : <FileVideo size={14} />} {attachment.name || 'File đính kèm'}</span>
      </button>
      {removable && (
        <button type="button" className="support-attachment-remove" onClick={onRemove} aria-label="Xóa tệp">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function SupportTicketModal({ request, note, onNoteChange, onClose, onChangeStatus, onReload }) {
  const [messages, setMessages] = React.useState([]);
  const [reply, setReply] = React.useState('');
  const [attachments, setAttachments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminSupportThread(request.id);
      setMessages(data.messages || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải hội thoại.');
    } finally {
      setLoading(false);
    }
  }, [request.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const selectFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 4 - attachments.length));
    event.target.value = '';
    try {
      const next = await Promise.all(files.map(readAttachment));
      setAttachments((current) => [...current, ...next].slice(0, 4));
    } catch (fileError) {
      setError(fileError.message);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!reply.trim() && attachments.length === 0) return;
    setSending(true);
    setError('');
    try {
      await sendAdminSupportMessage(request.id, { body: reply.trim(), attachments });
      setReply('');
      setAttachments([]);
      await load();
      onReload?.();
    } catch (sendError) {
      setError(sendError.message || 'Không thể gửi phản hồi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-modal-layer support-ticket-modal-layer" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <section className="admin-modal support-ticket-modal support-thread-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="support-ticket-modal-head">
          <div>
            <span className={`support-category ${request.category}`}>{CATEGORY_LABELS[request.category] || request.category}</span>
            <span className={`support-status ${request.status}`}>{STATUS_LABELS[request.status] || request.status}</span>
            <h2>{request.subject || 'Yêu cầu hỗ trợ'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng ticket"><X size={18} /></button>
        </header>

        <div className="support-ticket-modal-body">
          <div className="support-ticket-meta">
            <small>Người gửi: {request.users?.display_name || request.users?.email || request.contact_email || request.user_id}</small>
            <small>{time(request.created_at)} - Ticket #{String(request.id).slice(0, 8)}</small>
            {request.page_url && <small>Trang: {request.page_url}</small>}
          </div>

          <section className="support-ticket-section">
            <strong>Nội dung</strong>
            {request.message ? <p>{request.message}</p> : <p className="support-ticket-empty-line">Không có nội dung.</p>}
          </section>

          <section className="support-ticket-section">
            <strong>Ảnh / tệp đính kèm</strong>
            {request.attachments?.length > 0 ? (
              <div className="support-ticket-media-grid">
                {request.attachments.map((attachment) => (
                  <AttachmentPreview attachment={attachment} onPreview={setPreview} key={attachment.id || attachment.name} />
                ))}
              </div>
            ) : (
              <p className="support-ticket-empty-line">Không có ảnh.</p>
            )}
          </section>

          <div className={`support-thread-list admin-thread-list ${!loading && messages.length === 0 ? 'empty' : ''}`}>
            {loading && <p>Đang tải hội thoại...</p>}
            {!loading && messages.length === 0 && <p className="support-ticket-empty-line">Không có nội dung hội thoại.</p>}
            {messages.map((message) => (
              <article className={`support-thread-message ${message.senderType === 'admin' ? 'admin' : 'user'}`} key={message.id}>
                <strong>{message.senderType === 'admin' ? 'Admin' : request.users?.display_name || 'Người chơi'}</strong>
                {message.body && <p>{message.body}</p>}
                {message.attachments?.length > 0 && (
                  <div className="support-ticket-media-grid">
                    {message.attachments.map((attachment) => (
                      <AttachmentPreview attachment={attachment} onPreview={setPreview} key={attachment.id || attachment.name} />
                    ))}
                  </div>
                )}
                <small>{time(message.createdAt)}</small>
              </article>
            ))}
            {error && <p className="support-form-error">{error}</p>}
          </div>

          {!['resolved', 'dismissed'].includes(request.status) && (
            <form className="support-thread-composer" onSubmit={sendReply}>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Trả lời người chơi..."
                rows={4}
                maxLength={4000}
              />
              {attachments.length > 0 && (
                <div className="support-ticket-media-grid">
                  {attachments.map((attachment) => (
                    <AttachmentPreview
                      attachment={attachment}
                      removable
                      onPreview={setPreview}
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
                  <input type="file" accept="image/*,video/*" multiple onChange={selectFiles} />
                </label>
                <button type="submit" disabled={sending || (!reply.trim() && attachments.length === 0)}>
                  <Send size={17} /> {sending ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </div>
            </form>
          )}

          <label className="support-ticket-note">
            <span>Ghi chú xử lý</span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Ghi chú nội bộ hoặc kết luận xử lý..."
              rows={3}
            />
          </label>
        </div>

        <footer className="support-actions support-ticket-modal-actions">
          <button type="button" onClick={() => onChangeStatus(request, 'in_review', note)}>Đang xử lý</button>
          <button type="button" onClick={() => onChangeStatus(request, 'waiting_user', note)}>Chờ người chơi</button>
          <button type="button" onClick={() => onChangeStatus(request, 'resolved', note)}>Đã giải quyết</button>
          <button type="button" onClick={() => onChangeStatus(request, 'dismissed', note)}>Đóng ticket</button>
        </footer>
      </section>
      {preview && (
        <div className="admin-media-preview-layer" role="dialog" aria-modal="true" onMouseDown={() => setPreview(null)}>
          <button type="button" className="admin-media-preview-close" onClick={() => setPreview(null)} aria-label="Đóng ảnh">
            <X size={22} />
          </button>
          <div className="admin-media-preview-frame" onMouseDown={(event) => event.stopPropagation()}>
            {preview.isVideo ? (
              <video src={preview.source} controls autoPlay />
            ) : (
              <img src={preview.source} alt={preview.name || 'Ảnh đính kèm'} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportSection({
  requests,
  page,
  totalPages,
  status,
  loading = false,
  onStatusFilter,
  onPageChange,
  onChangeStatus,
  onReload
}) {
  const [notes, setNotes] = React.useState({});
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const noteFor = (request) => notes[request.id] ?? request.admin_note ?? '';
  const openCount = requests.filter((request) => ['new', 'in_review', 'waiting_user'].includes(request.status)).length;

  return (
    <section className="admin-panel">
      <div className="support-dashboard">
        <div><span>Đang mở</span><strong>{openCount}</strong></div>
        <div><span>Thanh toán</span><strong>{requests.filter((request) => request.category === 'billing').length}</strong></div>
        <div><span>Mới nhất</span><strong>{requests[0]?.created_at ? time(requests[0].created_at) : '--'}</strong></div>
      </div>

      <div className="admin-panel-head support-panel-head">
        <div><span>Hộp thư hỗ trợ</span><h2>Yêu cầu từ người chơi</h2></div>
        <div className="support-filter-pills">
          <button className={!status ? 'active' : ''} onClick={() => onStatusFilter('')} type="button">Tất cả</button>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button className={status === key ? 'active' : ''} onClick={() => onStatusFilter(key)} key={key} type="button">{label}</button>
          ))}
        </div>
      </div>

      <div className="admin-report-list">
        {loading && <LoadingBlock label="Đang tải yêu cầu hỗ trợ" />}
        {!loading && requests.length === 0 && <div className="support-empty-state"><strong>Chưa có yêu cầu hỗ trợ</strong></div>}
        {requests.map((request) => (
          <article className="admin-report-card admin-support-card clickable" key={request.id} onClick={() => setSelectedRequest(request)}>
            <div>
              <div className="support-card-topline">
                <span className={`support-category ${request.category}`}>{CATEGORY_LABELS[request.category] || request.category}</span>
                <span className={`support-status ${request.status}`}>{STATUS_LABELS[request.status] || request.status}</span>
              </div>
              <strong>{request.subject || 'Yêu cầu hỗ trợ'}</strong>
              <small>Người gửi: {request.users?.display_name || request.users?.email || request.contact_email || request.user_id}</small>
              <small>{time(request.created_at)} - Ticket #{String(request.id).slice(0, 8)}</small>
              <em>{request.message}</em>
            </div>
            <div className="support-actions"><button type="button">Xem chi tiết</button></div>
          </article>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} label="Phân trang yêu cầu hỗ trợ" />

      {selectedRequest && createPortal((
        <SupportTicketModal
          request={selectedRequest}
          note={noteFor(selectedRequest)}
          onNoteChange={(value) => setNotes((current) => ({ ...current, [selectedRequest.id]: value }))}
          onClose={() => setSelectedRequest(null)}
          onReload={onReload}
          onChangeStatus={async (request, nextStatus, adminNote) => {
            await onChangeStatus(request, nextStatus, adminNote);
            setSelectedRequest(null);
          }}
        />
      ), document.body)}
    </section>
  );
}
