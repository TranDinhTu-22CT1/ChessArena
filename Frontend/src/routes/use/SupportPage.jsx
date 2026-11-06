import React from 'react';
import { ArrowRight, CreditCard, FileVideo, HelpCircle, Image as ImageIcon, LifeBuoy, Loader2, MailCheck, MessageSquare, Paperclip, Search, Send, ShieldCheck, UserRound, Wifi, X } from 'lucide-react';
import { createSupportRequest } from '../../api/support';
import { notify } from '../../components/ToastHost';
import '../../styles/support-center.css';

const CATEGORIES = [
  { value: 'account', label: 'Tài khoản / đăng nhập' },
  { value: 'billing', label: 'Thanh toán / gói thành viên' },
  { value: 'online', label: 'Chơi online / kết nối' },
  { value: 'puzzle', label: 'Puzzle / luyện tập' },
  { value: 'technical', label: 'Lỗi kỹ thuật' },
  { value: 'general', label: 'Câu hỏi khác' }
];

const FAQS = [
  {
    question: 'Không nhận được OTP thì làm gì?',
    answer: 'Kiểm tra spam/quảng cáo, chắc chắn email nhập đúng, rồi đợi hết thời gian đếm ngược trước khi gửi lại OTP. Nếu vẫn lỗi, gửi yêu cầu kèm email đăng nhập.'
  },
  {
    question: 'Thanh toán rồi nhưng chưa lên gói?',
    answer: 'Gửi mã giao dịch, email tài khoản và thời điểm thanh toán. Bộ phận hỗ trợ sẽ đối chiếu với PayPal và cập nhật trạng thái gói nếu hợp lệ.'
  },
  {
    question: 'Đang chơi online bị mất kết nối?',
    answer: 'Tải lại trang trước, sau đó kiểm tra mạng. Nếu ván vẫn bị treo, gửi yêu cầu kèm thời gian, đối thủ và ảnh lỗi nếu có.'
  },
  {
    question: 'Muốn báo cáo người chơi xúc phạm hoặc quấy rối?',
    answer: 'Gửi tên người chơi, ván liên quan và mô tả ngắn. Nội dung xúc phạm hoặc quấy rối sẽ được quản trị viên kiểm tra.'
  },
  {
    question: 'AI Coach trả lời chưa đúng thì sao?',
    answer: 'Gửi lại vị trí ván hoặc FEN nếu có. AI Coach chỉ hỗ trợ phân tích tham khảo, quản trị viên có thể kiểm tra lỗi hệ thống nếu câu trả lời bị lệch.'
  }
];

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);
const MAX_FILES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORT_DRAFT_PREFIX = 'chessarena:support-draft:';

function supportIdentity(authUser) {
  return String(authUser?.uid || authUser?.id || authUser?.email || 'guest');
}

function readDraft(identity) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(`${SUPPORT_DRAFT_PREFIX}${identity}`) || '{}');
    return {
      category: CATEGORIES.some((item) => item.value === value.category) ? value.category : 'general',
      subject: String(value.subject || '').slice(0, 140),
      message: String(value.message || '').slice(0, 2200)
    };
  } catch {
    return { category: 'general', subject: '', message: '' };
  }
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

export default function SupportPage({ authUser, onLogin, onNavigate, supportEmail, embedded = false }) {
  const identity = supportIdentity(authUser);
  const [form, setForm] = React.useState(() => readDraft(identity));
  const [attachments, setAttachments] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sentRequest, setSentRequest] = React.useState(null);
  const [error, setError] = React.useState('');
  const [readingFiles, setReadingFiles] = React.useState(false);
  const submitting = React.useRef(false);
  const formRef = React.useRef(null);

  React.useEffect(() => {
    setForm(readDraft(identity));
    setAttachments([]);
    setSentRequest(null);
    setError('');
  }, [identity]);

  React.useEffect(() => {
    window.sessionStorage.setItem(`${SUPPORT_DRAFT_PREFIX}${identity}`, JSON.stringify(form));
  }, [form, identity]);

  const filteredFaqs = FAQS.filter((item) => {
    const text = `${item.question} ${item.answer}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const updateField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

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
    setReadingFiles(true);
    try {
      const nextAttachments = await Promise.all(accepted.map(readAttachment));
      setAttachments((current) => [...new Map([...current, ...nextAttachments].map(file => [file.id, file])).values()].slice(0, MAX_FILES));
    } catch (error) {
      notify(error.message || 'Không thể đọc file đã chọn.', 'error');
    } finally { setReadingFiles(false); }
  };

  const submitSupport = async (event) => {
    event.preventDefault();
    if (submitting.current || readingFiles) return;
    setError('');
    if (!authUser) {
      notify('Đăng nhập để gửi yêu cầu hỗ trợ cho quản trị viên.', 'info');
      onLogin?.();
      return;
    }
    const message = form.message.trim();
    if (message.length < 12) {
      setError('Hãy mô tả ít nhất 12 ký tự để quản trị viên hiểu vấn đề của bạn.');
      return;
    }

    submitting.current = true;
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
      window.sessionStorage.removeItem(`${SUPPORT_DRAFT_PREFIX}${identity}`);
      notify('Đã gửi yêu cầu hỗ trợ cho quản trị viên.', 'success');
    } catch (error) {
      setError(error.message || 'Chưa thể gửi yêu cầu. Nội dung của bạn vẫn được giữ lại để thử lại.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const chooseTopic = (category) => {
    updateField('category', category);
    formRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    formRef.current?.querySelector('input[name="subject"]')?.focus({ preventScroll: true });
  };
  const Root = embedded ? 'section' : 'main';
  return (
    <Root className={`support-center ${embedded ? 'embedded' : ''}`}>
      <header className="support-center-hero">
        <span className="support-center-eyebrow"><LifeBuoy size={16} /> CHESSARENA · HỖ TRỢ</span>
        <h1>Mình có thể giúp gì cho bạn?</h1>
        {supportEmail && <p>Email hỗ trợ: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}
        <p>Tìm câu trả lời nhanh hoặc gửi yêu cầu để được hỗ trợ trực tiếp.</p>
        <label className="support-center-search"><Search size={20} /><input aria-label="Tìm câu hỏi hỗ trợ" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm về tài khoản, thanh toán, kết nối..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={17} /></button>}</label>
        <button type="button" className="support-history-link" onClick={() => onNavigate?.('supportTickets')}>Yêu cầu của tôi <ArrowRight size={16} /></button>
      </header>
      <nav className="support-topic-grid" aria-label="Chủ đề hỗ trợ">
        {[['account', UserRound, 'Tài khoản & đăng nhập', 'Email, mật khẩu và xác thực'], ['billing', CreditCard, 'Thanh toán & gói', 'PayPal, quyền lợi và gia hạn'], ['online', Wifi, 'Chơi online', 'Ghép trận, lời mời và kết nối']].map(([category, Icon, title, text]) => <button type="button" key={category} onClick={() => chooseTopic(category)}><span><Icon size={22} /></span><div><strong>{title}</strong><small>{text}</small></div><ArrowRight size={17} /></button>)}
      </nav>
      <div className="support-center-grid">
        <section className="support-compose-card" ref={formRef} aria-labelledby="support-compose-title">
          <header><span className="support-section-icon"><MessageSquare size={21} /></span><div><h2 id="support-compose-title">Gửi yêu cầu hỗ trợ</h2><p>Mô tả càng rõ, việc kiểm tra càng nhanh.</p></div></header>
          {sentRequest && <div className="support-success-card" role="status"><MailCheck size={25} /><div><strong>Đã nhận yêu cầu của bạn</strong><p>Mã yêu cầu #{String(sentRequest.id).slice(0,8)}. Bạn có thể xem phản hồi và trao đổi tiếp trong hộp thư hỗ trợ.</p><button type="button" onClick={() => onNavigate?.('supportTickets')}>Theo dõi yêu cầu <ArrowRight size={15} /></button></div></div>}
          {!authUser && <div className="support-signin-note"><ShieldCheck size={18} /><span>Đăng nhập để gửi và theo dõi yêu cầu.</span><button type="button" onClick={onLogin}>Đăng nhập</button></div>}
          <form onSubmit={submitSupport}>
            <fieldset disabled={busy}>
              <label><span>Vấn đề cần hỗ trợ</span><select value={form.category} onChange={event => updateField('category',event.target.value)}>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label><span>Tiêu đề <small>Không bắt buộc</small></span><input name="subject" value={form.subject} onChange={event => updateField('subject',event.target.value)} placeholder="Ví dụ: Gói Pro chưa được kích hoạt" maxLength={140} /></label>
              <label><span>Nội dung cần hỗ trợ</span><textarea value={form.message} onChange={event => updateField('message',event.target.value)} placeholder="Bạn đang gặp vấn đề gì? Hãy cho biết thao tác vừa thực hiện, thời điểm và thông báo lỗi nếu có." rows={7} maxLength={2200} required aria-describedby="support-message-hint" /></label>
              <div className="support-field-hint" id="support-message-hint"><span>Tối thiểu 12 ký tự</span><span>{form.message.length}/2200</span></div>
              <label className="support-upload-zone"><Paperclip size={21} /><strong>{readingFiles ? 'Đang đọc tệp...' : 'Đính kèm ảnh hoặc video'}</strong><small>Tối đa 4 tệp · 10 MB mỗi tệp</small><input aria-label="Đính kèm ảnh hoặc video" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple disabled={readingFiles || attachments.length >= MAX_FILES} onChange={selectAttachments} /></label>
              {attachments.length > 0 && <div className="support-file-list">{attachments.map(file => <div key={file.id}>{file.mimeType.startsWith('image/') ? <ImageIcon size={18} /> : <FileVideo size={18} />}<span>{file.name}<small>{formatSize(file.size)}</small></span><button type="button" aria-label={`Xóa tệp ${file.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== file.id))}><X size={17} /></button></div>)}</div>}
              {error && <p className="support-inline-error" role="alert">{error}</p>}
              <footer><p><ShieldCheck size={16} /> Yêu cầu được gắn với tài khoản của bạn.</p><button className="support-send-button" type="submit" disabled={busy || readingFiles}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}{busy ? 'Đang gửi...' : 'Gửi yêu cầu'}</button></footer>
            </fieldset>
          </form>
        </section>
        <aside className="support-answers-card" aria-labelledby="support-faq-title">
          <header><HelpCircle size={21} /><h2 id="support-faq-title">Câu hỏi thường gặp</h2></header>
          <div className="support-answer-list">{filteredFaqs.map(item => <details key={item.question} open={query.trim() ? true : undefined}><summary>{item.question}</summary><p>{item.answer}</p></details>)}{!filteredFaqs.length && <div className="support-no-results"><Search size={27} /><strong>Chưa có câu trả lời phù hợp</strong><p>Gửi yêu cầu bên cạnh để quản trị viên hỗ trợ bạn.</p></div>}</div>
          <div className="support-follow-up"><MessageSquare size={22} /><strong>Đã gửi yêu cầu trước đó?</strong><p>Xem trạng thái, đọc phản hồi và bổ sung thông tin trong cùng cuộc trao đổi.</p><button type="button" onClick={() => onNavigate?.('supportTickets')}>Mở hộp thư hỗ trợ <ArrowRight size={16} /></button></div>
        </aside>
      </div>
    </Root>
  );
}
