import React from 'react';
import { Bot, ChevronDown, Loader2, Lock, Send, Sparkles } from 'lucide-react';
import { askAiCoach } from '../api/aiCoach';
import { notify } from './ToastHost';

const QUICK_PROMPTS = [
  'Phan tich the co hien tai',
  'Nuoc tiep theo nen can nhac gi?',
  'Toi vua sai o dau?',
  'Ke hoach 3 nuoc toi la gi?'
];

function MessageBubble({ message }) {
  return (
    <div className={`ai-coach-message ${message.role}`}>
      <span>{message.role === 'assistant' ? 'AI Coach' : 'Ban'}</span>
      <p>{message.content}</p>
    </div>
  );
}

export default function AiCoachChat({ authUser, context, onLogin }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState(() => ([
    {
      role: 'assistant',
      content: 'Minh la AI Coach. Hoi ve the co, nuoc vua di, ke hoach tan cong/phong thu hoac loi chien thuat.'
    }
  ]));
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const submitQuestion = async (question) => {
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion || busy) return;
    if (!authUser) {
      setOpen(true);
      notify('Dang nhap de su dung AI Coach.', 'info');
      return;
    }

    const nextMessages = [...messages, { role: 'user', content: cleanQuestion }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);

    try {
      const data = await askAiCoach({
        question: cleanQuestion,
        messages: messages.slice(-8),
        context
      });
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }].slice(-18));
    } catch (error) {
      const text = error.message || 'AI Coach dang ban. Thu lai sau.';
      setMessages((current) => [...current, { role: 'assistant', content: text }].slice(-18));
      notify(text, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`ai-coach-chat ${open ? 'open' : ''}`} aria-label="AI Coach chat">
      {open && (
        <section className="ai-coach-panel">
          <header>
            <div>
              <span><Sparkles size={15} /> AI Coach</span>
              <strong>Hoi nhanh ve van co</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Thu gon AI Coach">
              <ChevronDown size={18} />
            </button>
          </header>

          {!authUser ? (
            <div className="ai-coach-locked">
              <Lock size={24} />
              <strong>Can dang nhap</strong>
              <p>AI Coach dung phien dang nhap de gioi han spam va doc context van co an toan.</p>
              <button type="button" onClick={onLogin}>Dang nhap</button>
            </div>
          ) : (
            <>
              <div className="ai-coach-list" ref={listRef}>
                {messages.map((message, index) => (
                  <MessageBubble message={message} key={`${message.role}-${index}-${message.content.slice(0, 12)}`} />
                ))}
                {busy && (
                  <div className="ai-coach-thinking">
                    <Loader2 size={16} /> Dang suy nghi...
                  </div>
                )}
              </div>

              <div className="ai-coach-prompts">
                {QUICK_PROMPTS.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => submitQuestion(prompt)} disabled={busy}>
                    {prompt}
                  </button>
                ))}
              </div>

              <form onSubmit={(event) => {
                event.preventDefault();
                submitQuestion(input);
              }}>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Hoi AI ve the co..."
                  maxLength={700}
                  disabled={busy}
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Gui cau hoi">
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
