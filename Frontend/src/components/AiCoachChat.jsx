import React from 'react';
import {
  ArrowUpRight,
  Bot,
  ChevronDown,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Square,
} from 'lucide-react';

import { askAiCoach } from '../api/aiCoach';
import { clearLegacyAiChats } from '../api/chatSession';
import './ai-coach-session.css';

const INTRO =
  'Xin chào! Mình là AI Coach. Bạn muốn phân tích thế cờ hay hỏi điều gì về cờ vua?';

const BOARD_PROMPTS = [
  'Phân tích thế cờ',
  'Nước đi tốt nhất?',
  'Tôi đang sai ở đâu?',
];

const GENERAL_PROMPTS = [
  'Tôi mới bắt đầu',
  'Bạn có thể giúp gì?',
  'Chơi trung cuộc',
];

const initialMessages = () => [
  {
    role: 'assistant',
    content: INTRO,
  },
];

/* =========================================================
   MESSAGE
   ========================================================= */

function CoachMessage({ message }) {
  const isUser = message.role === 'user';

  const sources = (message.sources || [])
    .filter(
      (source) =>
        typeof source?.title === 'string' &&
        (!source.url ||
          (typeof source.url === 'string' &&
            (/^https:\/\//.test(source.url) ||
              /^\/(?!\/)/.test(source.url))))
    )
    .slice(0, 3);

  const knowledgeStatus = message.knowledge?.status;

  const warningText = {
    clarify: 'Cần thêm thông tin',
    unavailable: 'Chưa thể kiểm chứng',
    insufficient: 'Chưa đủ dữ liệu',
  };

  return (
    <div
      className={`cac-message ${
        isUser ? 'cac-message--user' : 'cac-message--ai'
      }`}
    >
      {!isUser && (
        <div className="cac-message-avatar">
          <Bot size={15} strokeWidth={2} />
        </div>
      )}

      <div className="cac-message-main">
        {!isUser && (
          <div className="cac-message-author">
            AI Coach
          </div>
        )}

        <div className="cac-message-text">
          {String(message.content || '')
            .replace(/\*\*/g, '')
            .split('\n')
            .map((line, index) => (
              <p key={index}>
                {line || '\u00a0'}
              </p>
            ))}
        </div>

        {message.position && (
          <div className="cac-position">
            Stockfish · depth {message.position.depth} ·{' '}
            {message.position.turn === 'w'
              ? 'Trắng đi'
              : 'Đen đi'}
          </div>
        )}

        {warningText[knowledgeStatus] && (
          <div className="cac-warning">
            {warningText[knowledgeStatus]}
          </div>
        )}

        {sources.length > 0 && (
          <div className="cac-sources">
            {sources.map((source, index) =>
              source.url ? (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{source.title}</span>
                  <ArrowUpRight size={11} />
                </a>
              ) : (
                <span key={`${source.title}-${index}`}>
                  {source.title}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   AI COACH
   ========================================================= */

export default function AiCoachChat({
  authUser,
  context = {},
  onLogin,
  onNavigate,
}) {
  const [open, setOpen] = React.useState(false);

  const [messages, setMessages] =
    React.useState(initialMessages);

  const [input, setInput] =
    React.useState('');

  const [busy, setBusy] =
    React.useState(false);

  const [error, setError] =
    React.useState('');

  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const taskRef = React.useRef(null);
  const pendingRef = React.useRef(null);

  const identity =
    authUser?.uid ||
    authUser?.id ||
    authUser?.email ||
    '';

  /* =======================================================
     RESET
     ======================================================= */

  const reset = React.useCallback(() => {
    taskRef.current?.abort();

    taskRef.current = null;
    pendingRef.current = null;

    setMessages(initialMessages());
    setInput('');
    setBusy(false);
    setError('');
  }, []);

  React.useEffect(() => {
    clearLegacyAiChats(
      window.localStorage
    );

    clearLegacyAiChats(
      window.sessionStorage
    );

    reset();

    return () => {
      taskRef.current?.abort();
    };
  }, [identity, reset]);

  /* =======================================================
     SCROLL
     ======================================================= */

  React.useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      const node = listRef.current;

      if (!node) return;

      node.scrollTo({
        top: node.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages, busy, error, open]);

  React.useEffect(() => {
    if (!open || !authUser) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => {
      clearTimeout(timer);
    };
  }, [open, authUser]);

  /* =======================================================
     STOP
     ======================================================= */

  const stop = () => {
    taskRef.current?.abort();

    taskRef.current = null;

    setBusy(false);

    setError('Đã dừng câu trả lời.');
  };

  /* =======================================================
     SEND API
     ======================================================= */

  const send = async (payload) => {
    if (taskRef.current) return;

    const controller =
      new AbortController();

    taskRef.current = controller;
    pendingRef.current = payload;

    setBusy(true);
    setError('');

    const timeout =
      window.setTimeout(() => {
        controller.abort();
      }, 24000);

    try {
      const data = await askAiCoach({
        ...payload,
        signal: controller.signal,
      });

      if (
        taskRef.current !== controller ||
        controller.signal.aborted
      ) {
        return;
      }

      setMessages((current) =>
        [
          ...current,
          {
            role: 'assistant',
            content: data.answer,
            position: data.position,
            sources: data.sources,
            knowledge: data.knowledge,
            suggestions: data.suggestions,
            action: data.action === 'support' ? 'support' : undefined,
          },
        ].slice(-40)
      );

      pendingRef.current = null;
    } catch (err) {
      if (
        taskRef.current === controller
      ) {
        setError(
          controller.signal.aborted
            ? 'Phản hồi mất quá lâu. Hãy thử lại.'
            : err?.message ||
                'Không thể nhận phản hồi.'
        );
      }
    } finally {
      window.clearTimeout(timeout);

      if (
        taskRef.current === controller
      ) {
        taskRef.current = null;

        setBusy(false);

        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    }
  };

  /* =======================================================
     SUBMIT
     ======================================================= */

  const submitQuestion = (question) => {
    const text =
      String(question || '').trim();

    if (
      !authUser ||
      !text ||
      taskRef.current
    ) {
      return;
    }

    const payload = {
      question: text,

      messages: messages
        .filter(
          (message) => !message.action
        )
        .slice(-24)
        .map(({ role, content }) => ({
          role,
          content,
        })),

      context: {
        ...context,
        assistantMode: 'coach',
      },
    };

    const next = [
      ...messages,
      {
        role: 'user',
        content: text,
      },
    ].slice(-40);

    setMessages(next);

    setInput('');
    setError('');

    send(payload);
  };

  const latestReply = messages.at(-1)?.role === 'assistant' ? messages.at(-1) : null;
  const suggestions = Array.isArray(latestReply?.suggestions)
    ? [...new Set(latestReply.suggestions.filter(value => typeof value === 'string' && value.trim() && value.length <= 100))].slice(0, 3)
    : null;
  const prompts = suggestions ?? (context.hasBoardContext
      ? BOARD_PROMPTS
      : GENERAL_PROMPTS);

  const isFreshChat =
    messages.length === 1 &&
    !busy;

  /* =======================================================
     JSX
     ======================================================= */

  return (
    <aside
      className={`cac-widget ${
        open ? 'cac-widget--open' : ''
      }`}
    >
      {open && (
        <section className="cac-panel">
          {/* HEADER */}

          <header className="cac-header">
            <div className="cac-brand">
              <div className="cac-brand-icon">
                <Bot size={18} />
              </div>

              <div className="cac-brand-text">
                <strong>AI Coach</strong>

                {context.hasBoardContext && (
                  <span>
                    Bàn cờ đã kết nối
                  </span>
                )}
              </div>
            </div>

            <div className="cac-header-actions">
              {authUser && (
                <button
                  type="button"
                  aria-label="Chat mới"
                  title="Chat mới"
                  onClick={reset}
                >
                  <RotateCcw size={16} />
                </button>
              )}

              <button
                type="button"
                aria-label="Thu gọn"
                title="Thu gọn"
                onClick={() =>
                  setOpen(false)
                }
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </header>

          {!authUser ? (
            /* LOGIN */

            <div className="cac-login">
              <div className="cac-login-icon">
                <Lock size={22} />
              </div>

              <strong>
                Đăng nhập để sử dụng AI Coach
              </strong>

              <p>
                Phân tích thế cờ và nhận
                hỗ trợ ngay trong ChessArena.
              </p>

              <button
                type="button"
                onClick={onLogin}
              >
                Đăng nhập
              </button>
            </div>
          ) : (
            <>
              {/* MESSAGES */}

              <main
                ref={listRef}
                className="cac-messages"
                role="log"
                aria-live="polite"
              >
                {messages.map(
                  (message, index) => (
                    <React.Fragment
                      key={index}
                    >
                      <CoachMessage
                        message={message}
                      />

                      {message.action ===
                        'support' && (
                        <button
                          type="button"
                          className="cac-support"
                          onClick={() => {
                            setOpen(false);

                            onNavigate?.(
                              'support'
                            );
                          }}
                        >
                          Mở trang Hỗ trợ

                          <ArrowUpRight
                            size={12}
                          />
                        </button>
                      )}
                    </React.Fragment>
                  )
                )}

                {/* THINKING */}

                {busy && (
                  <div className="cac-thinking">
                    <div className="cac-thinking-avatar">
                      <Bot size={14} />
                    </div>

                    <div className="cac-thinking-content">
                      <Loader2 size={14} />

                      <span>
                        Đang chuẩn bị câu trả lời…
                      </span>
                    </div>
                  </div>
                )}

                {/* ERROR */}

                {error && (
                  <div
                    className="cac-error"
                    role="alert"
                  >
                    <span>{error}</span>

                    {pendingRef.current &&
                      !busy && (
                        <button
                          type="button"
                          onClick={() =>
                            send(
                              pendingRef.current
                            )
                          }
                        >
                          Thử lại
                        </button>
                      )}
                  </div>
                )}
              </main>

              {/* QUICK PROMPTS */}

              {!busy && prompts.length > 0 && (
                <div className="cac-quick" aria-label="Gợi ý hỏi tiếp">
                  {prompts.map(
                    (prompt) => (
                      <button
                        type="button"
                        key={prompt}
                        onClick={() =>
                          submitQuestion(
                            prompt
                          )
                        }
                      >
                        {prompt}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* COMPOSER */}

              <footer className="cac-footer">
                <form
                  className="cac-composer"
                  onSubmit={(event) => {
                    event.preventDefault();

                    submitQuestion(input);
                  }}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    maxLength={900}
                    value={input}
                    placeholder="Nhắn cho AI Coach..."
                    aria-label="Nhắn cho AI Coach"
                    onChange={(event) =>
                      setInput(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          'Enter' &&
                        !event.shiftKey &&
                        !event
                          .nativeEvent
                          .isComposing
                      ) {
                        event.preventDefault();

                        submitQuestion(
                          input
                        );
                      }
                    }}
                  />

                  {busy ? (
                    <button
                      type="button"
                      className="cac-send cac-send--stop"
                      aria-label="Dừng"
                      onClick={stop}
                    >
                      <Square
                        size={13}
                        fill="currentColor"
                      />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="cac-send"
                      aria-label="Gửi"
                      disabled={
                        !input.trim()
                      }
                    >
                      <Send size={16} />
                    </button>
                  )}
                </form>
              </footer>
            </>
          )}
        </section>
      )}

      {/* LAUNCHER */}

      <button
        type="button"
        className="cac-launcher"
        aria-label={
          open
            ? 'Đóng AI Coach'
            : 'Mở AI Coach'
        }
        aria-expanded={open}
        onClick={() =>
          setOpen((value) => !value)
        }
      >
        <Bot size={19} />

        <span>AI Coach</span>
      </button>
    </aside>
  );
}
