import React from 'react';
import { FileVideo, HelpCircle, Image as ImageIcon, LifeBuoy, Loader2, MailCheck, MessageSquare, Paperclip, Search, Send, ShieldCheck, X } from 'lucide-react';
import { createSupportRequest } from '../../api/support';
import { notify } from '../../components/ToastHost';

const CATEGORIES = [
  { value: 'account', label: 'Tài khoản / đăng nhập' },
  { value: 'billing', label: 'Thanh toán / gói thành viên' },
  { value: 'online', label: 'Chơi online / kết nối' },
  { value: 'puzzle', label: 'Puzzle / luyện tập' },
  { value: 'tournament', label: 'Giải đấu' },
  { value: 'technical', label: 'Lỗi kỹ thuật' },
  { value: 'general', label: 'Câu hỏi khác' }
];

const FAQS = [
  {
    question: 'Không nhận được OTP thì làm gì?',
    answer: 'Kiểm tra spam/quảng cáo, chắc chắn email nhập đúng, rồi đợi hết thời gian đếm ngược trước khi gửi lại OTP. Nếu vẫn lỗi, gửi ticket kèm email đăng nhập.'
  },
  {
    question: 'Thanh toán rồi nhưng chưa lên gói?',
    answer: 'Gửi mã giao dịch, email tài khoản và thời điểm thanh toán. Admin sẽ đối chiếu webhook PayPal/MoMo và cập nhật trạng thái gói nếu hợp lệ.'
  },
  {
    question: 'Đang chơi online bị mất kết nối?',
    answer: 'Tải lại trang trước, sau đó kiểm tra mạng. Nếu ván vẫn bị treo, gửi ticket kèm thời gian, đối thủ và ảnh lỗi nếu có.'
  },
  {
    question: 'Muốn báo cáo người chơi xúc phạm hoặc gian lận?',
    answer: 'Gửi tên người chơi, ván liên quan và mô tả ngắn. Nội dung xúc phạm, quấy rối hoặc gian lận sẽ được admin kiểm tra.'
  },
  {
    question: 'AI Coach trả lời chưa đúng thì sao?',
    answer: 'Gửi lại vị trí ván hoặc FEN nếu có. AI Coach chỉ hỗ trợ phân tích tham khảo, admin có thể kiểm tra lỗi hệ thống nếu câu trả lời bị lệch.'
  }
];

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);
const MAX_FILES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function inferCategory(text) {
  const value = String(text || '').toLowerCase();
  if (/otp|đăng nhập|dang nhap|mật khẩu|mat khau|email|tài khoản|tai khoan/.test(value)) return 'account';
  if (/thanh toán|thanh toan|paypal|momo|gói|goi|membership|premium|refund|hoàn tiền|hoan tien/.test(value)) return 'billing';
  if (/online|kết nối|ket noi|lag|ghép trận|ghep tran|matchmaking/.test(value)) return 'online';
  if (/báo cáo|bao cao|report|vi phạm|vi pham|xúc phạm|xuc pham|quấy rối|gian lận|admin/.test(value)) return 'general';
  if (/puzzle|rating/.test(value)) return 'puzzle';
  if (/giải đấu|giai dau|tournament/.test(value)) return 'tournament';
  if (/bug|lỗi|loi|crash|không bấm|khong bam/.test(value)) return 'technical';
  return 'general';
}

function readAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      dataUrl: String(reader.result || '')
    });
    reader.onerror = () => reject(new Error(`Không thể đọc file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function formatSize(size) {
  if (!size) return '0 KB';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(size / 1024)} KB`;
}

export default function SupportPage({ authUser, onLogin, onNavigate }) {
  const [form, setForm] = React.useState({ category: 'general', subject: '', message: '' });
  const [attachments, setAttachments] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sentRequest, setSentRequest] = React.useState(null);

  const filteredFaqs = FAQS.filter((item) => {
    const text = `${item.question} ${item.answer}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const updateField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'message' && current.category === 'general') next.category = inferCategory(value);
      return next;
    });
  };

  const selectAttachments = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const slots = Math.max(0, MAX_FILES - attachments.length);
    const accepted = files.slice(0, slots).filter((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        notify(`${file.name} không đúng định dạng ảnh/video.`, 'info');
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        notify(`${file.name} vượt quá 10 MB.`, 'info');
        return false;
      }
      return true;
    });
    try {
      const nextAttachments = await Promise.all(accepted.map(readAttachment));
      setAttachments((current) => [...current, ...nextAttachments].slice(0, MAX_FILES));
    } catch (error) {
      notify(error.message || 'Không thể đọc file đã chọn.', 'error');
    }
  };

  const submitSupport = async (event) => {
    event.preventDefault();
    if (!authUser) {
      notify('Đăng nhập để gửi yêu cầu hỗ trợ cho admin.', 'info');
      onLogin?.();
      return;
    }
    const message = form.message.trim();
    if (message.length < 12) {
      notify('Mô tả vấn đề rõ hơn một chút để admin xử lý nhanh.', 'info');
      return;
    }

    setBusy(true);
    try {
      const data = await createSupportRequest({
        category: form.category,
        subject: form.subject.trim() || message.slice(0, 120),
        message,
        attachments,
        pageUrl: window.location.href,
        context: {
          assistantMode: 'support-page',
          pageUrl: window.location.href,
          route: 'support'
        }
      });
      setSentRequest(data.request || null);
      setForm({ category: 'general', subject: '', message: '' });
      setAttachments([]);
      notify('Đã gửi yêu cầu hỗ trợ cho admin.', 'success');
    } catch (error) {
      notify(error.message || 'Không thể gửi yêu cầu hỗ trợ.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="support-page">
      <section className="support-hero">
        <div>
          <span><LifeBuoy size={16} /> Trung tâm hỗ trợ</span>
          <h1>Liên hệ admin ChessArena</h1>
          <p>Gửi vấn đề rõ ràng để admin kiểm tra tài khoản, thanh toán, ván online hoặc báo cáo người chơi.</p>
        </div>
        <div className="support-hero-actions">
          <button type="button" onClick={() => onNavigate?.('supportTickets')}>Ticket của tôi</button>
          <button type="button" onClick={() => onNavigate?.('home')}>Về trang chủ</button>
        </div>
      </section>

      <section className="support-layout">
        <form className="support-ticket-form" onSubmit={submitSupport}>
          <div className="support-card-head">
            <MessageSquare size={22} />
            <div>
              <span>Gửi yêu cầu</span>
              <h2>Cho admin biết bạn cần gì</h2>
            </div>
          </div>

          {!authUser && (
            <div className="support-auth-note">
              <ShieldCheck size={18} />
              <span>Bạn cần đăng nhập để ticket gắn đúng tài khoản.</span>
              <button type="button" onClick={onLogin}>Đăng nhập</button>
            </div>
          )}

          <label>
            <span>Loại hỗ trợ</span>
            <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
              {CATEGORIES.map((category) => (
                <option value={category.value} key={category.value}>{category.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Tiêu đề</span>
            <input
              value={form.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              placeholder="Ví dụ: Thanh toán chưa kích hoạt gói"
              maxLength={140}
            />
          </label>

          <label>
            <span>Nội dung cần hỗ trợ</span>
            <textarea
              value={form.message}
              onChange={(event) => updateField('message', event.target.value)}
              placeholder="Mô tả vấn đề, tài khoản/email liên quan, thời điểm xảy ra lỗi và ảnh/video nếu có."
              rows={8}
              maxLength={2200}
            />
          </label>

          <label className="support-file-picker">
            <span><Paperclip size={16} /> Ảnh hoặc video</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={selectAttachments} />
            <small>Tối đa {MAX_FILES} file, mỗi file tối đa 10 MB.</small>
          </label>

          {attachments.length > 0 && (
            <div className="support-attachment-list">
              {attachments.map((file) => (
                <div key={file.id}>
                  {file.mimeType.startsWith('image/') ? <ImageIcon size={16} /> : <FileVideo size={16} />}
                  <span>{file.name}</span>
                  <small>{formatSize(file.size)}</small>
                  <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} aria-label="Xóa file">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="support-submit" type="submit" disabled={busy}>
            {busy ? <Loader2 size={18} /> : <Send size={18} />}
            Gửi cho admin
          </button>

          {sentRequest && (
            <div className="support-sent">
              <MailCheck size={20} />
              <span>Đã tạo ticket #{String(sentRequest.id || '').slice(0, 8)}. Bạn có thể theo dõi ở trang Ticket của tôi.</span>
            </div>
          )}
        </form>

        <aside className="support-faq-panel">
          <div className="support-card-head">
            <HelpCircle size={22} />
            <div>
              <span>Câu hỏi thường gặp</span>
              <h2>Tự xử lý nhanh</h2>
            </div>
          </div>
          <label className="support-faq-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm câu hỏi..." />
          </label>
          <div className="support-faq-list">
            {filteredFaqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
            {filteredFaqs.length === 0 && <p className="support-faq-empty">Không thấy câu hỏi phù hợp. Hãy gửi ticket cho admin.</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}
