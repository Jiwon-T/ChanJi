import React, { useState, useEffect } from 'react';
import { doc, serverTimestamp, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase.ts';
import { Profile, Memory } from '../types.ts';
import { X, Camera, Trash2, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { MEMORY_IMAGE_BUDGET, compressImage } from '../lib/utils.ts';
import { DeleteModal } from '../components/modals.tsx';
import { showToast } from '../lib/toast.ts';

export function MemoryEditor({ date, profile, existingMemory, onSaveSuccess }: { 
  date: string, 
  profile: Profile, 
  existingMemory?: Memory,
  onSaveSuccess?: () => void
}) {
  const coupleId = profile.id;
  const [title, setTitle] = useState(existingMemory?.title || '');
  const [content, setContent] = useState(existingMemory?.content || '');
  const [images, setImages] = useState<string[]>(existingMemory?.images || []);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Author info display logic
  const authorInfo = React.useMemo(() => {
    if (!existingMemory) return null;
    const isPartner1 = existingMemory.userId === profile.members[0];
    const name = isPartner1 ? profile.partner1 : profile.partner2;
    const image = isPartner1 ? profile.partner1Image : profile.partner2Image;
    
    let timeStr = '';
    try {
      if (existingMemory.createdAt?.toDate) {
        timeStr = format(existingMemory.createdAt.toDate(), 'HH:mm');
      } else {
        timeStr = format(new Date(), 'HH:mm');
      }
    } catch (e) {
      timeStr = '--:--';
    }

    return { name, image, time: timeStr };
  }, [existingMemory, profile]);

  // Update transient state when existingMemory changes
  useEffect(() => {
    setTitle(existingMemory?.title || '');
    setContent(existingMemory?.content || '');
    setImages(existingMemory?.images || []);
  }, [existingMemory, date]);

  const handleSave = async () => {
    if (!content.trim() && !title.trim() && images.length === 0) return;
    setSaving(true);
    
    // Determine current user's role for initial save snapshots
    const isPartner1 = auth.currentUser?.uid === profile.members[0];
    const authorName = isPartner1 ? profile.partner1 : profile.partner2;
    const authorImage = isPartner1 ? profile.partner1Image : profile.partner2Image;

    try {
      if (existingMemory) {
        await updateDoc(doc(db, 'couples', coupleId, 'memories', existingMemory.id), {
          title,
          content,
          images,
          updatedAt: serverTimestamp()
        });
      } else {
        const created = await addDoc(collection(db, 'couples', coupleId, 'memories'), {
          date,
          title,
          content,
          images,
          userId: auth.currentUser?.uid,
          authorName: authorName || 'Unknown',
          authorImage: authorImage || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Add notification for the other partner
        const otherUserId = profile.members.find(m => m !== auth.currentUser?.uid);
        if (otherUserId) {
          await addDoc(collection(db, 'couples', coupleId, 'notifications'), {
            type: 'memory_saved',
            title: '새로운 추억이 기록되었습니다!',
            message: `${authorName}님이 '${title || date}'의 추억을 남겼어요. ❤️`,
            userId: otherUserId,
            read: false,
            createdAt: serverTimestamp(),
            // 알림을 누르면 이 기록으로 이동
            targetDate: date,
            targetId: created.id

          });
        }
      }
      showToast(existingMemory ? '기록을 수정했어요' : '기록을 저장했어요');
      if (onSaveSuccess) onSaveSuccess();
    } catch (e) {
      console.error(e);
      showToast('기록을 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const usedBytes = images.reduce((sum, img) => sum + img.length, 0);

  const addImages = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      setSaving(true);
      const added: string[] = [];
      let total = usedBytes;
      let skipped = 0;
      try {
        for (const file of files) {
          // 기본 크기로 넣어 보고, 남은 용량이 부족하면 한 번 더 작게 줄여 봅니다.
          let compressed = await compressImage(file);
          if (total + compressed.length > MEMORY_IMAGE_BUDGET) {
            compressed = await compressImage(file, 560, 560);
          }
          if (total + compressed.length > MEMORY_IMAGE_BUDGET) {
            skipped++;
            continue;
          }
          total += compressed.length;
          added.push(compressed);
        }
        setImages((prev) => [...prev, ...added]);
        if (skipped > 0) {
          showToast(`한 기록에 담을 수 있는 사진 용량을 넘어서 ${skipped}장은 추가하지 못했어요.\n같은 날짜에 기록을 하나 더 만들어 나눠 올려주세요.`, 'error');
        }
      } catch (error) {
        console.error("Image upload error:", error);
        if (added.length) setImages((prev) => [...prev, ...added]);
        showToast('사진을 처리하지 못했어요.', 'error');
      } finally {
        setSaving(false);
      }
    };
    input.click();
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleDelete = async () => {
    if (!existingMemory) return;
    setShowDeleteModal(false);
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'memories', existingMemory.id));
      showToast('기록을 삭제했어요');
      if (onSaveSuccess) onSaveSuccess();
    } catch (e) {
      console.error(e);
      showToast('기록을 삭제하지 못했어요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {existingMemory && authorInfo && (
        <div className="flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-surface-card">
            {authorInfo.image ? (
              <img src={authorInfo.image} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-hint">
                <UserIcon size={18} />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">{authorInfo.name}</p>
            <p className="text-[10px] text-text-hint font-medium">{authorInfo.time + ' 에 기록됨'}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase text-text-hint mb-1 block px-1 tracking-widest">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="기억하고 싶은 제목을 적어주세요"
            className="w-full bg-white shadow-inner border border-divider rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-border-point placeholder:text-text-hint text-text-primary font-bold"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-text-hint mb-1 block px-1 tracking-widest">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘의 소중한 기록을 남겨보세요..."
            className="w-full h-40 bg-white shadow-inner border border-divider rounded-[24px] p-5 outline-none resize-none focus:ring-2 focus:ring-border-point placeholder:text-text-hint text-text-secondary leading-relaxed"
          />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-sm">
              <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button
                onClick={() => removeImage(i)}
                aria-label="사진 삭제"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {usedBytes < MEMORY_IMAGE_BUDGET * 0.95 && (
            <button
              onClick={addImages}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-border-point flex flex-col items-center justify-center text-text-hint hover:border-btn-secondary hover:text-btn-secondary hover:bg-white transition-all bg-surface-card/30"
            >
              <Camera size={24} />
              <span className="text-[10px] mt-1 font-bold">여러 장 선택</span>
            </button>
          )}
        </div>
        {images.length > 0 && (
          <div className="mt-3 px-1">
            <div className="flex justify-between text-[10px] text-text-hint font-bold mb-1">
              <span>사진 {images.length}장</span>
              <span>용량 {Math.min(100, Math.round((usedBytes / MEMORY_IMAGE_BUDGET) * 100))}%</span>
            </div>
            <div className="h-1 rounded-full bg-divider/60 overflow-hidden">
              <div className="h-full bg-btn-secondary" style={{ width: `${Math.min(100, (usedBytes / MEMORY_IMAGE_BUDGET) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-btn-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-divider hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
        >
          {saving ? '저장 중...' : (existingMemory ? '기록 수정하기' : '소중한 기록 저장')}
        </button>
        {existingMemory && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-4 bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-colors active:scale-95"
          >
            <Trash2 size={24} />
          </button>
        )}
      </div>

      <DeleteModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        onConfirm={handleDelete}
        title="기록 삭제"
      />
    </div>
  );
}
