import React from 'react';
import { Bot, ChevronDown, ListPlus, Loader2, Lock, Send } from 'lucide-react';
import { askAiCoach } from '../api/aiCoach';
import { notify } from './ToastHost';

const INTRO = 'Mình là AI Coach. Hỏi về thế cờ, nước đi, kế hoạch tấn công/phòng thủ hoặc lỗi chiến thuật.';
const BOARD_PROMPTS = [
  'Đọc FEN hiện tại và tóm tắt thế cờ',
  'Bên đang đi có những nước ứng viên nào?',
  'Nước vừa rồi có điểm yếu gì?',
  'Kế hoạch thực dụng trong 3 nước tới?'
];
const GENERAL_PROMPTS = [
  'Làm sao phân tích một thế cờ?',
  'Checklist trước khi đi một nước',
  'Các lỗi chiến thuật thường gặp',
  'Cách lập kế hoạch khai cuộc/trung cuộc'
];
const HISTORY_LIMIT = 24;
const SUPPORT_REDIRECT_PHRASES = [
  'can ho tro', 'can admin', 'gap admin', 'hoi admin', 'hoi dap voi admin',
  'lien he admin', 'nhan vien ho tro', 'tao ticket', 'mo ticket', 'gui ticket',
  'can ticket', 'can xu ly', 'nho admin', 'bao loi', 'khieu nai', 'to cao',
  'bao cao nguoi choi', 'hoan tien giup', 'kiem tra tai khoan giup'
];
const SUPPORT_REDIRECT_MESSAGE = 'Tôi không thể xử lý trực tiếp yêu cầu này trong AI Coach. Tôi sẽ chuyển bạn đến trang hỗ trợ để tạo ticket và theo dõi phản hồi từ admin.';
const ADMIN_SUPPORT_TERMS = [
  'admin', 'hỗ trợ', 'ho tro', 'support', 'ticket', 'tài khoản', 'tai khoan',
  'thanh toán', 'thanh toan', 'paypal', 'momo', 'báo cáo', 'bao cao',
  'gian lận', 'gian lan', 'vi phạm', 'vi pham', 'refund', 'hoàn tiền', 'hoan tien'
];

function normalizeQuestion(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function needsAdminSupportRedirect(value) {
  const text = normalizeQuestion(value);
  const mentionsAdmin = /\badm[a-z0-9_]{1,6}\b/.test(text) || text.includes('admin');
  const mentionsSupportArea = ADMIN_SUPPORT_TERMS.some((term) => text.includes(normalizeQuestion(term)));
  const asksForHelp = /\b(can|muon|nho|gap|hoi|lien he|tao|mo|gui|bao|khieu nai|to cao|xu ly)\b/.test(text);
  return SUPPORT_REDIRECT_PHRASES.some((phrase) => text.includes(phrase))
    || ((mentionsAdmin || mentionsSupportArea) && asksForHelp && text.includes('admin'));
}

function initialMessages() {
  return [{ role: 'assistant', content: INTRO }];
}

function storageKey(authUser) {
  const id = String(authUser?.id || authUser?.uid || authUser?.email || authUser?.username || 'guest').toLowerCase();
  return `chessarena.ai-coach.v3:${id}`;
}

function readHistory(authUser) {
  if (typeof window === 'undefined' || !authUser) return initialMessages();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(authUser)) || 'null');
    if (!Array.isArray(parsed) || parsed.length === 0) return initialMessages();
    return parsed
      .filter((message) => ['assistant', 'user'].includes(message?.role) && String(message?.content || '').trim())
      .slice(-HISTORY_LIMIT);
  } catch {
    return initialMessages();
  }
}

function saveHistory(authUser, messages) {
  if (typeof window === 'undefined' || !authUser) return;
  try {
    window.localStorage.setItem(storageKey(authUser), JSON.stringify(messages.slice(-HISTORY_LIMIT)));
  } catch {
    // localStorage may be unavailable in private mode.
  }
}

function MessageBubble({ message }) {
  return (
    <div className={`ai-coach-message ${message.role}`}>
      <span>{message.role === 'assistant' ? 'AI Coach' : 'Bạn'}</span>
      <p>{message.content}</p>
    </div>
  );
}

export default function AiCoachChat({ authUser, context, onLogin, onNavigate }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState(initialMessages);
  const [busy, setBusy] = React.useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const listRef = React.useRef(null);
  const hasBoardContext = Boolean(context?.hasBoardContext && context?.fen);
  const prompts = hasBoardContext ? BOARD_PROMPTS : GENERAL_PROMPTS;

  React.useEffect(() => {
    setMessages(readHistory(authUser));
    setInput('');
  }, [authUser?.id, authUser?.uid, authUser?.email, authUser?.username]);

  React.useEffect(() => {
    saveHistory(authUser, messages);
  }, [authUser, messages]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const submitQuestion = async (question) => {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion || busy) return;
    if (needsAdminSupportRedirect(cleanQuestion)) {
      const nextMessages = [...messages, { role: 'user', content: cleanQuestion }, { role: 'assistant', content: SUPPORT_REDIRECT_MESSAGE }].slice(-HISTORY_LIMIT);
      setMessages(nextMessages);
      setInput('');
      setSuggestionsOpen(false);
      setOpen(true);
      notify(SUPPORT_REDIRECT_MESSAGE, 'info');
      window.setTimeout(() => {
        setOpen(false);
        onNavigate?.('support');
      }, 1400);
      return;
    }
    if (!authUser) {
      setOpen(true);
      notify('Đăng nhập để dùng AI Coach.', 'info');
      return;
    }

    const activeMessages = messages;
    setMessages([...activeMessages, { role: 'user', content: cleanQuestion }].slice(-HISTORY_LIMIT));
    setInput('');
    setSuggestionsOpen(false);
    setBusy(true);

    try {
      const data = await askAiCoach({
        question: cleanQuestion,
        messages: activeMessages.slice(-8),
        context: {
          ...context,
          assistantMode: 'coach'
        }
      });
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }].slice(-HISTORY_LIMIT));
    } catch (error) {
      const text = error.message || 'AI Coach đang bận. Thử lại sau.';
      setMessages((current) => [...current, { role: 'assistant', content: text }].slice(-HISTORY_LIMIT));
      notify(text, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`ai-coach-chat ${open ? 'open' : ''}`} aria-label="AI Coach ChessArena">
      {open && (
        <section className="ai-coach-panel">
          <header>
            <div className="ai-coach-avatar">
              <Bot size={20} />
            </div>
            <div>
              <span>ChessArena</span>
              <strong>AI Coach</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Thu gọn AI Coach">
              <ChevronDown size={18} />
            </button>
          </header>

          {!authUser ? (
            <div className="ai-coach-locked">
              <Lock size={24} />
              <strong>Cần đăng nhập</strong>
              <p>Lịch sử AI Coach được lưu riêng theo từng tài khoản.</p>
              <button type="button" onClick={onLogin}>Đăng nhập</button>
            </div>
          ) : (
            <>
              <div className="ai-coach-list" ref={listRef}>
                {messages.map((message, index) => (
                  <MessageBubble message={message} key={`${message.role}-${index}-${message.content.slice(0, 12)}`} />
                ))}
                {busy && (
                  <div className="ai-coach-thinking">
                    <Loader2 size={16} /> Đang suy nghĩ...
                  </div>
                )}
              </div>

              <details className="ai-coach-suggestions" open={suggestionsOpen} onToggle={(event) => setSuggestionsOpen(event.currentTarget.open)}>
                <summary><ListPlus size={15} /> Gợi ý nhanh</summary>
                <div>
                  {prompts.map((prompt) => (
                    <button type="button" key={prompt} onClick={() => submitQuestion(prompt)} disabled={busy}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </details>

              <form onSubmit={(event) => {
                event.preventDefault();
                submitQuestion(input);
              }}>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Hỏi về thế cờ, nước đi, luật..."
                  maxLength={700}
                  disabled={busy}
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi câu hỏi">
                  {busy ? <Loader2 size={17} /> : <Send size={17} />}
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <button className="ai-coach-fab" type="button" onClick={() => setOpen((value) => !value)}>
        <Bot size={20} />
        <span>AI Coach</span>
      </button>
    </aside>
  );
}
