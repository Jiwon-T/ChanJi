import { useState } from 'react';
import { doc, serverTimestamp, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase.ts';
import { Profile } from '../types.ts';
import { Heart, Plus, Camera, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/toast.ts';
import { ConfirmModal } from '../components/modals.tsx';

export function SettingsView({ profile, onSignOut, onImageAction }: {
  profile: Profile,
  onSignOut: () => void,
  onImageAction: (field: 'partner1Image' | 'partner2Image' | 'coverImage') => void
}) {
  const [partner1, setPartner1] = useState(profile.partner1);
  const [partner2, setPartner2] = useState(profile.partner2);
  const [startDate, setStartDate] = useState(profile.startDate);
  const [saving, setSaving] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [pendingJoin, setPendingJoin] = useState<{ code: string, members: string[] } | null>(null);

  const handleUpdate = async () => {
    if (!partner1.trim() || !partner2.trim() || !startDate) {
      showToast('이름과 만난 날을 모두 입력해 주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        partner1: partner1.trim(),
        partner2: partner2.trim(),
        startDate,
        updatedAt: serverTimestamp()
      });
      showToast('설정을 저장했어요');
    } catch (e) {
      console.error(e);
      showToast('설정을 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.id);
      showToast('초대 코드를 복사했어요. 상대방에게 전달해 주세요.');
    } catch {
      showToast('복사하지 못했어요. 코드를 길게 눌러 직접 복사해 주세요.', 'error');
    }
  };

  // 1단계: 코드 확인 → 확인 창 띄우기
  const checkJoinCode = async () => {
    const code = joinCode.trim();
    if (!code) return showToast('초대 코드를 입력해 주세요.', 'error');
    if (code === profile.id) return showToast('내 초대 코드는 입력할 수 없어요.', 'error');
    try {
      const snap = await getDoc(doc(db, 'couples', code));
      if (!snap.exists()) return showToast('올바르지 않은 초대 코드예요.', 'error');
      const data = snap.data();
      if (data.members.length >= 2) return showToast('이미 두 사람이 연결된 공간이에요.', 'error');
      setPendingJoin({ code, members: data.members });
    } catch (e) {
      console.error(e);
      showToast('코드를 확인하지 못했어요. 코드를 다시 확인해 주세요.', 'error');
    }
  };

  // 2단계: 확인 후 실제로 합치기
  const join = async () => {
    if (!pendingJoin) return;
    const { code, members } = pendingJoin;
    setPendingJoin(null);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'couples', code), {
        members: [...members, auth.currentUser?.uid],
        updatedAt: serverTimestamp()
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `couples/${code}`);
        throw err;
      });

      // 지금 쓰던 혼자만의 공간 정리
      if (profile.id === auth.currentUser?.uid) {
        await deleteDoc(doc(db, 'couples', profile.id)).catch(err => {
          handleFirestoreError(err, OperationType.DELETE, `couples/${profile.id}`);
          throw err;
        });
      } else {
        await updateDoc(doc(db, 'couples', profile.id), {
          members: profile.members.filter(m => m !== auth.currentUser?.uid),
          updatedAt: serverTimestamp()
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `couples/${profile.id}`);
          throw err;
        });
      }

      showToast('상대방의 공간과 연결됐어요!');
      setTimeout(() => window.location.reload(), 800); // 새 공간 기준으로 다시 불러오기
    } catch (e) {
      console.error(e);
      showToast('연결하지 못했어요. 코드나 권한을 확인해 주세요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pt-4 space-y-8 pb-10 max-w-xl mx-auto">
      {/* 초대 코드 */}
      <div className="bg-btn-primary text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/20 rounded-full blur-xl" />
        <h3 className="text-xs font-bold tracking-widest opacity-80 mb-2">나의 초대 코드</h3>
        <div className="flex items-center justify-between gap-4">
          <code className="text-xl font-bold bg-white/20 px-3 py-1 rounded-lg flex-1 overflow-hidden text-ellipsis select-all">{profile.id}</code>
          <button
            onClick={copyCode}
            className="bg-white text-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
          >
            복사
          </button>
        </div>
        <p className="text-[10px] mt-2 opacity-70">상대방이 이 코드를 입력하면 둘만의 공간이 연결됩니다.</p>
      </div>

      {/* 상대방 공간으로 합치기 */}
      {profile.members.length < 2 && (
        <div className="glass p-6 rounded-3xl border-2 border-accent-impact/20 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon size={16} className="text-accent-impact" />
            <h3 className="text-sm font-bold text-text-primary">상대방의 공간으로 합치기</h3>
          </div>
          <p className="text-[11px] text-text-hint leading-relaxed">
            이미 상대방이 계정을 만들었다면, 상대방의 초대 코드를 입력해 그 공간으로 이동할 수 있습니다.
            <span className="text-btn-primary font-bold">(현재 나의 기록은 사라집니다)</span>
          </p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="상대방 초대 코드"
              className="flex-1 min-w-0 bg-white border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point text-sm"
            />
            <button
              onClick={checkJoinCode}
              disabled={saving}
              className="bg-accent-impact text-white px-5 rounded-xl font-bold text-sm shadow-lg shadow-accent-impact/20 shrink-0 disabled:opacity-50"
            >
              연결하기
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => onImageAction('coverImage')}
        className="w-full aspect-[2/1] rounded-3xl overflow-hidden glass border-2 border-dashed border-border-point flex flex-col items-center justify-center text-text-hint hover:border-btn-secondary transition-all group"
      >
        {profile.coverImage ? (
          <img src={profile.coverImage} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
        ) : (
          <>
            <Camera size={32} />
            <span className="text-sm font-medium mt-2">메인 커버 사진 설정</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-4">
        <button onClick={() => onImageAction('partner1Image')} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full border-4 border-white dreamy-shadow overflow-hidden bg-surface-card">
            {profile.partner1Image ? <img src={profile.partner1Image} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Plus className="m-auto text-text-hint" />}
          </div>
          <span className="text-xs text-text-hint font-medium">{profile.partner1} 사진</span>
        </button>
        <Heart className="w-6 h-6 text-icon-bg" />
        <button onClick={() => onImageAction('partner2Image')} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full border-4 border-white dreamy-shadow overflow-hidden bg-surface-card">
            {profile.partner2Image ? <img src={profile.partner2Image} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Plus className="m-auto text-text-hint" />}
          </div>
          <span className="text-xs text-text-hint font-medium">{profile.partner2} 사진</span>
        </button>
      </div>

      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint ml-1">이름 1</label>
          <input value={partner1} onChange={e => setPartner1(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint ml-1">이름 2</label>
          <input value={partner2} onChange={e => setPartner2(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint ml-1">우리가 만난 날</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="w-full bg-btn-primary text-white rounded-xl py-3 font-medium hover:opacity-90 transition-colors mt-4 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '정보 수정'}
        </button>
      </div>

      <button onClick={onSignOut} className="w-full text-text-hint text-sm hover:text-red-400 transition-colors py-4">
        로그아웃
      </button>

      <ConfirmModal
        isOpen={!!pendingJoin}
        title="상대방의 공간으로 합칠까요?"
        message={'합쳐지면 지금 공간의 기록은 더 이상 볼 수 없어요.\n계속할까요?'}
        confirmLabel="합치기"
        danger
        onClose={() => setPendingJoin(null)}
        onConfirm={join}
      />
    </motion.div>
  );
}
