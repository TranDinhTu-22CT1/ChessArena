import React from 'react';

export function notify(message, tone = 'info') {
  window.dispatchEvent(new window.CustomEvent('chessarena:toast', {
    detail: { message, tone }
  }));
}

export default function ToastHost() {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    const onToast = (event) => {
      const item = {
        id: `${Date.now()}-${Math.random()}`,
        tone: event.detail?.tone || 'info',
        message: event.detail?.message || ''
      };
      setItems((current) => [...current, item].slice(-4));
      window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }, 4200);
    };
    window.addEventListener('chessarena:toast', onToast);
    return () => window.removeEventListener('chessarena:toast', onToast);
  }, []);

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((item) => (
        <div className={`toast-item ${item.tone}`} key={item.id}>{item.message}</div>
      ))}
    </div>
  );
}
