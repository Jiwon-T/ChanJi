import { CoupleNotification } from '../types.ts';
import { Heart, X, Camera, Bell, CheckCheck, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils.ts';

export function NotificationModal({ isOpen, onClose, notifications, onOpen, onMarkAllRead, onClearRead }: {
  isOpen: boolean,
  onClose: () => void,
  notifications: CoupleNotification[],
  onOpen: (n: CoupleNotification) => void,
  onMarkAllRead: () => void,
  onClearRead: () => void
}) {
  if (!isOpen) return null;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.length - unreadCount;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-end" onClick={onClose}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-app-bg shadow-2xl flex flex-col"
      >
        <div className="p-8 pb-5 border-b border-divider/50 bg-white/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-serif italic text-accent-impact">Notifications</h3>
              <p className="text-[11px] text-text-hint font-black mt-1">우리의 소식들</p>
            </div>
            <button onClick={onClose} aria-label="닫기" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-text-hint shadow-sm"><X size={20} /></button>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2 mt-5">
              <button
                onClick={onMarkAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white text-[11px] font-bold text-text-secondary shadow-sm disabled:opacity-40"
              >
                <CheckCheck size={13} /> 모두 읽음
              </button>
              <button
                onClick={onClearRead}
                disabled={readCount === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white text-[11px] font-bold text-text-secondary shadow-sm disabled:opacity-40"
              >
                <Trash2 size={13} /> 읽은 알림 지우기 {readCount > 0 && `(${readCount})`}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-20 text-text-hint">
              <Bell size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">알림이 없습니다.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                onClick={() => onOpen(n)}
                className={cn(
                  "p-5 rounded-[24px] border transition-all cursor-pointer relative overflow-hidden",
                  n.read ? "bg-white/40 border-transparent opacity-60" : "bg-white border-accent-impact/20 shadow-lg shadow-divider/30"
                )}
              >
                {!n.read && <div className="absolute top-0 right-0 w-8 h-8 bg-accent-impact/10 flex items-center justify-center rounded-bl-2xl"><div className="w-2 h-2 bg-accent-impact rounded-full" /></div>}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    n.type === 'memory_saved' ? "bg-purple-100 text-purple-500" : "bg-accent-impact/10 text-accent-impact"
                  )}>
                    {n.type === 'memory_saved' ? <Camera size={18} /> : <Heart size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-text-primary mb-1">{n.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{n.message}</p>
                    <p className="text-[9px] text-text-hint font-bold uppercase tracking-widest mt-3">
                      {format(n.createdAt?.toDate() || new Date(), 'yyyy. MM. dd HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
