import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ChevronLeft, Image as ImageIcon, Plus, User as UserIcon, X } from 'lucide-react';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { Memory, Profile } from '../types.ts';
import { MemoryEditor } from './MemoryEditor.tsx';
import { showToast } from '../lib/toast.ts';

// 같은 날짜 안에서는 먼저 쓴 기록이 위로
function sortByCreated(list: Memory[]) {
  return [...list].sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
}

// 날짜를 눌렀을 때 아래에서 올라오는 시트.
// 그날의 기록 목록을 보여 주고, 하나를 눌러 수정하거나 새 기록을 추가합니다.
export function DaySheet({ profile, date, initialMemoryId, onClose }: {
  profile: Profile,
  date: string,
  initialMemoryId: string | null,
  onClose: () => void
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);
  // null: 목록 / 'new': 새 기록 쓰기 / 그 밖: 해당 기록 수정
  const [editing, setEditing] = useState<string | null>(initialMemoryId);

  useEffect(() => {
    setLoaded(false);
    const q = query(collection(db, 'couples', profile.id, 'memories'), where('date', '==', date));
    return onSnapshot(q, (snap) => {
      setMemories(sortByCreated(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory))));
      setLoaded(true);
    }, (err) => {
      setLoaded(true);
      handleFirestoreError(err, OperationType.LIST, `couples/${profile.id}/memories (${date})`);
    });
  }, [profile.id, date]);

  useEffect(() => { setEditing(initialMemoryId); }, [date, initialMemoryId]);

  // 알림 등으로 열었는데 그 기록이 이미 지워졌다면 목록으로
  useEffect(() => {
    if (loaded && editing && editing !== 'new' && !memories.some((m) => m.id === editing)) {
      showToast('이미 삭제된 기록이에요.', 'error');
      setEditing(null);
    }
  }, [loaded, editing, memories]);

  // 그날 기록이 없으면 바로 새 기록 쓰기 화면
  const mode = editing ?? (loaded && memories.length === 0 ? 'new' : null);
  const editingMemory = mode && mode !== 'new' ? memories.find((m) => m.id === mode) : undefined;
  const backToList = () => setEditing(null);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col pt-10 md:items-center md:justify-center md:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="flex-1 bg-gradient-to-b from-app-bg to-white rounded-t-[48px] shadow-2xl relative flex flex-col overflow-hidden md:flex-none md:w-full md:max-w-xl md:h-[85vh] md:rounded-[40px]"
      >
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode && memories.length > 0 && (
              <button onClick={backToList} aria-label="목록으로" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-text-hint">
                <ChevronLeft size={22} />
              </button>
            )}
            <div>
              <h3 className="text-2xl font-serif text-text-primary">{format(parseISO(date), 'M월 d일')}</h3>
              <p className="text-[11px] text-text-hint font-bold mt-1">
                {mode === 'new' ? '새 기록' : mode ? '기록 수정' : `이 날의 기록 ${memories.length}개`}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-text-hint"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-32 no-scrollbar">
          {!loaded ? (
            <div className="py-20 flex justify-center">
              <div className="w-7 h-7 border-2 border-btn-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : mode ? (
            <div key={mode}>
              <MemoryEditor
                date={date}
                profile={profile}
                existingMemory={editingMemory}
                onSaveSuccess={memories.length > 0 || mode !== 'new' ? backToList : onClose}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setEditing(m.id)}
                  className="w-full text-left bg-white rounded-[24px] p-4 border border-border-point/60 shadow-sm flex items-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-surface-card shrink-0 flex items-center justify-center text-text-hint">
                    {m.images?.[0] ? <img src={m.images[0]} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{m.title || m.content?.slice(0, 20) || '제목 없음'}</p>
                    {m.title && m.content && <p className="text-xs text-text-secondary truncate mt-0.5">{m.content}</p>}
                    <p className="text-[10px] text-text-hint font-bold mt-1 flex items-center gap-1">
                      <UserIcon size={10} /> {m.authorName || '알 수 없음'}
                      {m.images?.length > 0 && <span className="ml-1">· 사진 {m.images.length}장</span>}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setEditing('new')}
                className="w-full py-4 rounded-[24px] border-2 border-dashed border-border-point text-text-hint font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
              >
                <Plus size={16} /> 이 날에 기록 하나 더 남기기
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
