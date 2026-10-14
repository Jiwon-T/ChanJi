import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { format } from 'date-fns';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CustomAnniversary, Profile } from '../types.ts';
import { cn } from '../lib/utils.ts';
import { buildMilestones, daysUntil, ddayLabel, Milestone } from '../lib/milestones.ts';
import { showToast } from '../lib/toast.ts';
import { DeleteConfirmModal } from '../components/modals.tsx';

// 처음에 보여 줄 다가오는 기념일 수 (직접 추가한 기념일은 항상 모두 보임)
const UPCOMING_PREVIEW = 8;

export function DDayView({ profile }: { profile: Profile }) {
  const [customAnniversaries, setCustomAnniversaries] = useState<CustomAnniversary[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'couples', profile.id, 'anniversaries'));
    return onSnapshot(q, (snap) => {
      setCustomAnniversaries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomAnniversary)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `couples/${profile.id}/anniversaries`);
    });
  }, [profile.id]);

  const { upcoming, past } = useMemo(() => {
    const all = buildMilestones(profile.startDate, customAnniversaries);
    const upcoming = all.filter((m) => daysUntil(m.date) >= 0);
    const past = all.filter((m) => daysUntil(m.date) < 0).reverse(); // 최근에 지난 것부터
    return { upcoming, past };
  }, [profile.startDate, customAnniversaries]);

  const visibleUpcoming = showAllUpcoming
    ? upcoming
    : upcoming.filter((m, i) => i < UPCOMING_PREVIEW || m.isCustom);

  const addAnniversary = async () => {
    if (!newLabel.trim() || !newDate) return;
    try {
      const created = await addDoc(collection(db, 'couples', profile.id, 'anniversaries'), {
        label: newLabel.trim(),
        date: newDate,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      // 상대방에게 알림
      const otherUserId = profile.members.find(m => m !== auth.currentUser?.uid);
      const isPartner1 = auth.currentUser?.uid === profile.members[0];
      const authorName = isPartner1 ? profile.partner1 : profile.partner2;
      if (otherUserId) {
        await addDoc(collection(db, 'couples', profile.id, 'notifications'), {
          type: 'anniversary_added',
          title: '새로운 기념일이 추가되었습니다!',
          message: `${authorName}님이 '${newLabel.trim()}' 기념일을 등록했어요. ✨`,
          userId: otherUserId,
          read: false,
          createdAt: serverTimestamp(),
          targetDate: newDate,
          targetId: created.id
        });
      }

      setIsAddModalOpen(false);
      setNewLabel('');
      showToast('기념일을 추가했어요');
    } catch (e) {
      console.error(e);
      showToast('기념일을 추가하지 못했어요. 다시 시도해 주세요.', 'error');
    }
  };

  const deleteAnniversary = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'couples', profile.id, 'anniversaries', id));
      setDeletingId(null);
    } catch (e) {
      console.error(e);
      showToast('기념일을 삭제하지 못했어요.', 'error');
    }
  };

  const row = (event: Milestone) => {
    const remaining = daysUntil(event.date);
    const isPast = remaining < 0;
    const isToday = remaining === 0;
    return (
      <div
        key={event.key}
        className={cn(
          "p-6 rounded-[32px] border transition-all duration-300 flex items-center justify-between",
          isToday ? "bg-btn-primary text-white border-transparent shadow-lg shadow-btn-primary/30"
            : isPast ? "bg-white/40 border-transparent"
            : "bg-white border-border-point shadow-md"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner",
            isToday ? "bg-white/25" : isPast ? "bg-app-bg" : "bg-icon-bg/20"
          )}>
            {isToday ? '🎉' : event.isCustom ? '⭐' : isPast ? '💍' : '⏳'}
          </div>
          <div>
            <h4 className={cn("text-sm font-black", isToday ? "text-white" : "text-text-primary")}>{event.label}</h4>
            <p className={cn("text-[10px] font-bold tracking-tight", isToday ? "text-white/80" : "text-text-hint")}>{format(event.date, 'yyyy. MM. dd')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-sm font-black",
            isToday ? "text-white" : isPast ? "text-text-hint" : "text-accent-impact"
          )}>
            {isPast ? '지난 날' : ddayLabel(remaining)}
          </span>
          {event.isCustom && (
            <button
              onClick={() => setDeletingId(event.customId!)}
              aria-label="기념일 삭제"
              className={cn("p-2 transition-colors", isToday ? "text-white/80" : "text-text-hint hover:text-red-400")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md lg:max-w-4xl mx-auto pt-4 pb-24 lg:pb-8"
    >
      <div className="flex justify-between items-center mb-10 px-2">
        <div className="text-left">
          <h2 className="text-2xl font-serif italic text-accent-impact">Our Milestones</h2>
          <p className="text-[10px] text-text-hint font-black uppercase tracking-[0.2em]">우리가 함께 걷는 길</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          aria-label="기념일 추가"
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-accent-impact shadow-lg shadow-divider/50 hover:bg-btn-primary hover:text-white transition-all transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      <p className="text-[11px] font-black text-text-secondary px-2 mb-3">다가오는 기념일</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleUpcoming.map(row)}
      </div>
      {!showAllUpcoming && upcoming.length > visibleUpcoming.length && (
        <button
          onClick={() => setShowAllUpcoming(true)}
          className="w-full mt-4 py-3 text-xs font-bold text-text-hint bg-white/50 rounded-2xl"
        >
          더 먼 기념일 보기 ({upcoming.length - visibleUpcoming.length}개)
        </button>
      )}

      {past.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full flex items-center justify-between px-2 mb-3 text-[11px] font-black text-text-secondary"
          >
            지난 기념일 {past.length}개
            <ChevronDown size={16} className={cn("transition-transform text-text-hint", showPast && "rotate-180")} />
          </button>
          {showPast && <div className="grid gap-4 lg:grid-cols-2">{past.map(row)}</div>}
        </div>
      )}

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-border-point"
            >
              <h3 className="text-xl font-bold mb-6 text-center text-text-primary">기념일 추가</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-text-hint mb-1 block px-1 tracking-widest">기념일 이름</label>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="예: 결혼 기념일, 첫 여행"
                    className="w-full bg-app-bg border border-divider/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-btn-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-text-hint mb-1 block px-1 tracking-widest">날짜</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-app-bg border border-divider/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-btn-primary/20"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-app-bg text-text-secondary rounded-2xl font-bold hover:bg-divider/20 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={addAnniversary}
                    disabled={!newLabel.trim() || !newDate}
                    className="flex-1 py-4 bg-btn-primary text-white rounded-2xl font-bold shadow-lg shadow-btn-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    추가하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <DeleteConfirmModal
            isOpen={true}
            title={customAnniversaries.find(a => a.id === deletingId)?.label || ''}
            onClose={() => setDeletingId(null)}
            onConfirm={() => deleteAnniversary(deletingId)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
