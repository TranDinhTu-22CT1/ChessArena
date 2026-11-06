import React from 'react';

let openModals = 0;
let previousOverflow = '';

// Native dialogs keep keyboard focus and pointer interaction above the page,
// including fixed navigation, chat buttons and clipped game containers.
export default function Modal({ open, onClose, className = '', children, ...props }) {
  const dialogRef = React.useRef(null);
  const pointerStartedOutside = React.useRef(false);

  React.useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (openModals === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModals += 1;
    dialog.showModal();
    return () => {
      dialog.close();
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      {...props}
      ref={dialogRef}
      className={`app-modal ${className}`}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.target.closest('dialog') !== event.currentTarget) return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      }}
      onPointerDown={(event) => {
        pointerStartedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pointerStartedOutside.current && event.target === event.currentTarget) onClose?.();
        pointerStartedOutside.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
