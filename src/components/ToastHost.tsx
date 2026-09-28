import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Toast, dismissToast, subscribeToasts } from '../lib/toast';

const STYLES = {
  error: { box: 'bg-rose-50 border-rose-200 text-rose-900', icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> },
  info: { box: 'bg-white border-slate-200 text-slate-800', icon: <Info className="w-4 h-4 text-blue-600 shrink-0" /> },
};

export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col items-end gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-full sm:w-96 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border shadow-lg text-sm ${STYLES[t.kind].box}`}
        >
          {STYLES[t.kind].icon}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="opacity-50 hover:opacity-100"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
