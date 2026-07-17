'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CloseIcon } from '@/components/icons';

type ToastKind = 'success' | 'error';
type ToastItem = { id: number; message: string; kind: ToastKind };

// Module-level store so toast() is callable from anywhere without context.
let items: ToastItem[] = [];
let subscribers: Array<() => void> = [];
let seq = 1;

const emit = () => subscribers.forEach((notify) => notify());

export function toast(message: string, kind: ToastKind = 'success') {
  const id = seq++;
  items = [...items, { id, message, kind }];
  emit();
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, 3400);
}

/** Bottom-right toast stack. Mount once in the root layout. */
export function Toaster() {
  const [, force] = useState(0);

  useEffect(() => {
    const notify = () => force((n) => n + 1);
    subscribers.push(notify);
    return () => {
      subscribers = subscribers.filter((sub) => sub !== notify);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[100] flex flex-col gap-2.5">
      {items.map((item) => {
        const ok = item.kind === 'success';
        return (
          <div
            key={item.id}
            role="status"
            className="animate-rise pointer-events-auto flex min-w-60 max-w-90 items-center gap-2.5 rounded-xl border border-line-soft bg-white px-4 py-3 text-[13.5px] text-ink shadow-float"
          >
            <span
              className={`grid size-5.5 shrink-0 place-items-center rounded-full text-white ${ok ? 'bg-accent' : 'bg-danger'}`}
            >
              {ok ? <CheckIcon size={12} strokeWidth={2.4} /> : <CloseIcon size={12} strokeWidth={2.4} />}
            </span>
            <span>{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}
