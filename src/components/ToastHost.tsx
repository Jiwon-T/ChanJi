import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { onToast, ToastDetail } from '../lib/toast.ts';
import { cn } from '../lib/utils.ts';

export function ToastHost() {
  const [toast, setToast] = useState<(ToastDetail & { id: number }) | null>(null);

  useEffect(() => onToast((t) => setToast({ ...t, id: Date.now() })), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 3500 : 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            'fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] max-w-[88vw] px-5 py-3 rounded-2xl text-xs font-bold shadow-xl text-center whitespace-pre-line',
            toast.kind === 'error' ? 'bg-red-500 text-white' : 'bg-text-primary/90 text-white'
          )}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
