'use client';

import { useEffect, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Centered destructive-action confirmation. Names the record being deleted,
 * disables everything while the request is in flight, closes on Escape or
 * overlay click (unless busy).
 */
export function ConfirmDialog({ title, message, confirmLabel, busyLabel, busy, onCancel, onConfirm }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [busy, onCancel]);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-[3px]"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise w-full max-w-md rounded-card border border-line-soft bg-white p-6 shadow-float"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow mb-1">Please confirm</p>
        <h3 className="font-serif text-2xl text-ink">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-ink-soft">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
