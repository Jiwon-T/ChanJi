import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Heart, Pencil, User as UserIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { Memory, Profile } from '../types.ts';
import { cn } from '../lib/utils.ts';
import { ImagePreviewModal } from '../components/ImagePreviewModal.tsx';
import { DaySheet } from './DaySheet.tsx';

const PAGE_SIZE = 5;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function MemoryCalendar({ profile, selectedDate, setSelectedDate, openMemoryId, setOpenMemoryId, currentMonth, setCurrentMonth }: {
  profile: Profile,
  selectedDate: Date | null,
  setSelectedDate: (d: Date | null) => void,
  // 시트를 열 때 바로 보여 줄 기록 (피드의 수정 버튼, 알림에서 이동할 때)
  openMemoryId: string | null,
  setOpenMemoryId: (id: string | null) => void,
  currentMonth: Date,
  setCurrentMonth: (d: Date) => void
}) {
  const coupleId = profile.id;
  const [monthMemories, setMonthMemories] = useState<Memory[]>([]);
  const [feedMemories, setFeedMemories] = useState<Memory[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ images: string[], index: number } | null>(null);

  // 달력: 보고 있는 달의 기록만 불러옵니다 (점 표시용)
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'memories'),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );
    return onSnapshot(q, (snap) => {
      setMonthMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `couples/${coupleId}/memories (${monthStart}~${monthEnd})`);
    });
  }, [coupleId, monthStart, monthEnd]);

  const countByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    monthMemories.forEach((m) => { counts[m.date] = (counts[m.date] ?? 0) + 1; });
    return counts;
  }, [monthMemories]);

  // 피드: 최신 기록부터 실시간으로. "더 보기"를 누를 때마다 PAGE_SIZE 만큼 늘립니다.
  useEffect(() => {
    const q = query(
      collection(db, 'couples', coupleId, 'memories'),
      orderBy('date', 'desc'),
      limit(pageCount * PAGE_SIZE)
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory));
      // 같은 날짜 안에서는 나중에 쓴 기록이 위로
      list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setFeedMemories(list);
      setFeedLoading(false);
    }, (error) => {
      setFeedLoading(false);
      handleFirestoreError(error, OperationType.LIST, `couples/${coupleId}/memories (feed)`);
    });
  }, [coupleId, pageCount]);

  const hasMore = feedMemories.length >= pageCount * PAGE_SIZE;

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const blanks = Array.from({ length: startOfMonth(currentMonth).getDay() }, (_, i) => i);

  const openDay = (day: Date, memoryId: string | null = null) => {
    setOpenMemoryId(memoryId);
    setSelectedDate(day);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 h-full flex flex-col lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-12 lg:items-start">
      {/* 달력 (PC에서는 왼쪽에 고정) */}
      <div className="lg:sticky lg:top-28 lg:bg-white/40 lg:rounded-[40px] lg:p-6 lg:border lg:border-white lg:shadow-lg lg:shadow-divider/20">
      {/* 달력 머리 */}
      <div className="flex items-center justify-between mb-8 px-1">
        <h2 className="text-2xl font-serif text-text-primary">{format(currentMonth, 'yyyy년 M월')}</h2>
        <div className="flex gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="이전 달" className="p-3 bg-white/50 rounded-2xl text-accent-impact hover:bg-white transition-colors shadow-sm"><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="다음 달" className="p-3 bg-white/50 rounded-2xl text-accent-impact hover:bg-white transition-colors shadow-sm"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 mb-4 opacity-60">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn("text-center text-[11px] font-black text-text-hint", i === 0 && "text-accent-impact")}>{d}</div>
        ))}
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-7 gap-2.5 mb-10">
        {blanks.map(b => <div key={`blank-${b}`} />)}
        {daysInMonth.map(day => {
          const count = countByDate[format(day, 'yyyy-MM-dd')] ?? 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => openDay(day)}
              className={cn(
                "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all",
                isSelected ? "bg-btn-primary text-white dreamy-shadow scale-110 z-10" : "bg-white/40 text-text-secondary hover:bg-white",
                isToday && !isSelected && "ring-2 ring-btn-primary/30"
              )}
            >
              <span className="text-sm font-bold">{format(day, 'd')}</span>
              {count > 0 && (
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full shadow-sm", isSelected ? "bg-white" : "bg-btn-primary")} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="hidden lg:block text-center text-[11px] text-text-hint font-bold -mt-4">날짜를 누르면 그날의 기록을 보고 쓸 수 있어요</p>
      </div>

      {/* 선택한 날짜의 기록 */}
      <AnimatePresence>
        {selectedDate && (
          <DaySheet
            profile={profile}
            date={format(selectedDate, 'yyyy-MM-dd')}
            initialMemoryId={openMemoryId}
            onClose={() => { setSelectedDate(null); setOpenMemoryId(null); }}
          />
        )}
      </AnimatePresence>

      {/* 피드 */}
      <div className="flex-1 min-h-0 flex flex-col mt-4 lg:mt-0">
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="w-8 h-8 bg-accent-impact/10 rounded-xl flex items-center justify-center text-accent-impact">
            <Heart size={16} className="fill-current" />
          </div>
          <h3 className="text-xl font-serif italic text-text-primary">Our Memories</h3>
          <span className="ml-auto text-[10px] font-black text-text-hint">우리의 기록</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6 pb-20 lg:pb-4 no-scrollbar">
          {feedMemories.map((memory) => (
            <motion.div
              key={memory.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-divider/20 border border-white"
            >
              {/* 작성자 */}
              <div className="p-5 flex items-center justify-between border-b border-app-bg/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-app-bg shadow-sm overflow-hidden bg-surface-card">
                    {memory.authorImage ? (
                      <img src={memory.authorImage} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-hint bg-divider/10">
                        <UserIcon size={18} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-text-primary">{memory.authorName || '알 수 없음'}</p>
                    <p className="text-[10px] text-text-hint font-bold">{format(parseISO(memory.date), 'yyyy년 M월 d일')}</p>
                  </div>
                </div>
                <button
                  onClick={() => openDay(parseISO(memory.date), memory.id)}
                  aria-label="기록 수정"
                  className="flex items-center gap-1 px-3 py-2 text-text-hint bg-app-bg rounded-xl text-[11px] font-bold"
                >
                  <Pencil size={13} /> 수정
                </button>
              </div>

              {/* 내용 */}
              <div className="p-5 space-y-4">
                {(memory.title || memory.content) && (
                  <div className="space-y-2">
                    {memory.title && (
                      <h4 className="text-base font-bold text-text-primary leading-tight px-1">{memory.title}</h4>
                    )}
                    {memory.content && (
                      <p className="text-sm text-text-secondary leading-relaxed px-1 font-medium italic whitespace-pre-wrap">
                        "{memory.content}"
                      </p>
                    )}
                  </div>
                )}

                {memory.images && memory.images.length > 0 && (
                  <div className={cn(
                    "grid gap-2 rounded-2xl overflow-hidden",
                    memory.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    {memory.images.slice(0, 4).map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage({ images: memory.images, index: idx })}
                        className={cn(
                          "relative aspect-square bg-app-bg cursor-zoom-in group",
                          memory.images.length === 3 && idx === 0 ? "row-span-2" : ""
                        )}
                      >
                        <img
                          src={img}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        {idx === 3 && memory.images.length > 4 && (
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-xl font-bold">
                            +{memory.images.length - 4}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={() => setPageCount((p) => p + 1)}
                className="px-8 py-3 bg-white text-btn-primary border-2 border-border-point rounded-2xl font-bold hover:bg-surface-card transition-all shadow-sm"
              >
                지난 기록 더 보기
              </button>
            </div>
          )}

          {!hasMore && feedMemories.length > 0 && (
            <div className="text-center py-8 opacity-50">
              <p className="text-[11px] font-bold text-text-hint">모든 기록을 불러왔어요</p>
            </div>
          )}

          {feedMemories.length === 0 && !feedLoading && (
            <div className="text-center py-20 bg-white/30 rounded-[40px] border-2 border-dashed border-border-point">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">📸</div>
              <h4 className="text-sm font-bold text-text-primary mb-1">아직 기록이 없어요</h4>
              <p className="text-[11px] text-text-hint font-medium">달력에서 날짜를 눌러 첫 기록을 남겨보세요</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            images={previewImage.images}
            index={previewImage.index}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
