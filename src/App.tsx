import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, signIn, logOut, OperationType, handleFirestoreError } from './lib/firebase.ts';
import { Profile, Memory, CustomAnniversary, CoupleNotification } from './types.ts';
import { Heart, Calendar as CalendarIcon, Settings, LogOut, Menu, X, Plus, Camera, Trash2, ChevronLeft, ChevronRight, User as UserIcon, Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, addDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

async function compressImage(file: File, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Using lower quality to stay under Firestore 1MB document limit
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function DeleteModal({ isOpen, onClose, onConfirm, title }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center border border-border-point"
      >
        <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 size={32} />
        </div>
        <h3 className="text-xl font-serif mb-2 text-text-primary">{title}</h3>
        <p className="text-text-secondary text-sm mb-8 leading-relaxed">이 기록은 다시 복구할 수 없습니다.<br/>정말 삭제하시겠습니까?</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-app-bg rounded-2xl text-text-secondary font-medium hover:bg-surface-card transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-btn-primary text-white rounded-2xl font-medium hover:opacity-90 shadow-lg shadow-divider transition-colors">삭제하기</button>
        </div>
      </motion.div>
    </div>
  );
}

function ImageActionModal({ isOpen, onClose, onUpload, onRemove, title }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onUpload: () => void, 
  onRemove: () => void,
  title: string 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center border border-border-point"
      >
        <div className="w-16 h-16 bg-surface-card rounded-full flex items-center justify-center mx-auto mb-6 text-accent-impact shadow-inner">
          <Camera size={32} />
        </div>
        <h3 className="text-xl font-serif mb-6 text-text-primary px-2">{title}</h3>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => { onUpload(); onClose(); }} 
            className="w-full py-4 bg-btn-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-btn-primary/20 hover:opacity-90 transition-all hover:scale-[1.02]"
          >
            <Camera size={20} />
            이미지 넣기
          </button>
          <button 
            onClick={() => { onRemove(); onClose(); }} 
            className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-100 transition-all"
          >
            <Trash2 size={20} />
            제거하기
          </button>
          <button 
            onClick={onClose} 
            className="w-full py-4 bg-app-bg text-text-hint rounded-2xl font-bold mt-2 hover:bg-divider/20 transition-colors"
          >
            취소
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, title }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void,
  title: string 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center border border-border-point"
      >
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner">
          <Trash2 size={32} />
        </div>
        <h3 className="text-xl font-serif mb-2 text-text-primary italic">기념일 삭제</h3>
        <p className="text-sm text-text-hint mb-8 font-medium">"{title}" 기념일을 삭제하시겠습니까?<br/>이 작업은 되돌릴 수 없습니다.</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-4 bg-app-bg text-text-hint rounded-2xl font-bold hover:bg-divider/20 transition-colors"
          >
            취소
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }} 
            className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
          >
            삭제하기
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NotificationModal({ isOpen, onClose, notifications, onMarkAsRead }: {
  isOpen: boolean,
  onClose: () => void,
  notifications: CoupleNotification[],
  onMarkAsRead: (id: string) => void
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-end">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md h-full bg-app-bg shadow-2xl flex flex-col"
      >
        <div className="p-8 border-b border-divider/50 flex items-center justify-between bg-white/50">
          <div>
            <h3 className="text-2xl font-serif italic text-accent-impact">Notifications</h3>
            <p className="text-[10px] text-text-hint font-black uppercase tracking-widest mt-1">우리의 소식들</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-text-hint shadow-sm"><X size={20} /></button>
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
                onClick={() => onMarkAsRead(n.id)}
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

function ImagePreviewModal({ src, onClose }: { src: string | null, onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-4 lg:p-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative max-w-full max-h-full"
      >
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-white flex items-center gap-2 font-bold"
        >
          <span className="text-[10px] uppercase tracking-widest">Close</span>
          <X size={24} />
        </button>
        <img 
          src={src} 
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" 
          referrerPolicy="no-referrer"
        />
      </motion.div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'settings' | 'dday'>('home');
  const [todayMemory, setTodayMemory] = useState<Memory | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sidebarMonth, setSidebarMonth] = useState(new Date());
  const [imageAction, setImageAction] = useState<{ field: 'partner1Image' | 'partner2Image' | 'coverImage' | null }>({ field: null });
  const [notifications, setNotifications] = useState<CoupleNotification[]>([]);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const couplesRef = collection(db, 'couples');
    const q = query(couplesRef, where('members', 'array-contains', user.uid));
    const ownRef = doc(db, 'couples', user.uid);
    let unsubOwn: (() => void) | null = null;
    const unsubList = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Profile);
        if (unsubOwn) { unsubOwn(); unsubOwn = null; }
      } else {
        if (!unsubOwn) {
          unsubOwn = onSnapshot(ownRef, (snap) => {
            if (snap.exists()) setProfile({ id: snap.id, ...snap.data() } as Profile);
            else setProfile(null);
          });
        }
      }
      setLoading(false);
    });
    return () => { unsubList(); if (unsubOwn) unsubOwn(); };
  }, [user]);

  useEffect(() => {
    if (!profile || !user) return;
    const q = query(
      collection(db, 'couples', profile.id, 'notifications'),
      where('userId', '==', user.uid)
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CoupleNotification));
      setNotifications(list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
    });
  }, [profile, user]);

  useEffect(() => {
    if (!profile) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const q = query(collection(db, 'couples', profile.id, 'memories'), where('date', '==', todayStr));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) setTodayMemory({ id: snap.docs[0].id, ...snap.docs[0].data() } as Memory);
      else setTodayMemory(null);
    });
  }, [profile]);

  const updateTextField = async (field: 'frameHeadline' | 'frameDate' | 'frameQuote', current: string) => {
    if (!profile) return;
    const newVal = prompt('수정할 내용을 입력해주세요:', current);
    if (newVal === null || newVal === current) return;
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        [field]: newVal,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateImage = async (field: 'partner1Image' | 'partner2Image' | 'coverImage') => {
    if (!profile) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const compressed = await compressImage(file);
          await updateDoc(doc(db, 'couples', profile.id), {
            [field]: compressed,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error("Image upload error:", error);
          alert("이미지 업로드 중 오류가 발생했습니다.");
        }
      }
    };
    input.click();
  };

  const removeImage = async (field: 'partner1Image' | 'partner2Image' | 'coverImage') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        [field]: null,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Image removal error:", e);
      alert("이미지 제거 중 오류가 발생했습니다.");
    }
  };

  const markAsRead = async (id: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'couples', profile.id, 'notifications', id), {
        read: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const hasUnread = notifications.some(n => !n.read);

  const nextMilestone = React.useMemo(() => {
    if (!profile) return null;
    const start = parseISO(profile.startDate);
    const diff = differenceInDays(new Date(), start);
    const intervals = [100, 200, 300, 365, 400, 500, 600, 700, 730, 800, 900, 1000];
    const next = intervals.find(i => i > diff) || ((Math.floor(diff / 500) + 1) * 500);
    const targetDate = addDays(start, next);
    return {
      days: next,
      remaining: next - diff,
      date: format(targetDate, 'MM. dd')
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-app-bg">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Heart className="w-12 h-12 text-btn-primary fill-btn-primary" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-app-bg px-6 text-center">
        <Heart className="w-20 h-20 text-btn-primary fill-btn-primary mb-6" />
        <h1 className="text-3xl font-serif text-text-primary mb-4">LoveDays</h1>
        <p className="text-text-secondary mb-8 max-w-xs italic">
          차니랑 지원이랑
        </p>
        <button
          onClick={signIn}
          className="bg-white text-btn-primary border-2 border-border-point px-8 py-3 rounded-full font-medium dreamy-shadow hover:bg-surface-card transition-all"
        >
          Google로 시작하기
        </button>
      </div>
    );
  }

  if (!profile && activeTab !== 'settings') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-surface-card px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 rounded-3xl w-full max-w-sm dreamy-shadow">
          <h2 className="text-2xl font-serif text-center mb-6">둘만의 공간 만들기</h2>
          <div className="space-y-4">
            <div className="bg-white/30 p-4 rounded-2xl mb-4 text-xs text-center text-accent-impact">
              새로운 연애를 기록하거나,<br/>상대방의 초대코드를 입력해 참가하세요.
            </div>
            
            <div className="space-y-4">
              <input id="p1-input" placeholder="이름 1" className="w-full bg-white/50 border border-border-point rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-divider placeholder:text-text-hint" />
              <input id="p2-input" placeholder="이름 2" className="w-full bg-white/50 border border-border-point rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-divider placeholder:text-text-hint" />
              <input id="date-input" type="date" className="w-full bg-white/50 border border-border-point rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-divider" />
              <button
                onClick={async () => {
                  const p1 = (document.getElementById('p1-input') as HTMLInputElement).value;
                  const p2 = (document.getElementById('p2-input') as HTMLInputElement).value;
                  const date = (document.getElementById('date-input') as HTMLInputElement).value;
                  if (!p1 || !p2 || !date) return alert('모든 정보를 입력해주세요!');
                  
                  try {
                    await setDoc(doc(db, 'couples', user.uid), {
                      partner1: p1,
                      partner2: p2,
                      startDate: date,
                      members: [user.uid],
                      updatedAt: serverTimestamp()
                    });
                  } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `couples/${user.uid}`);
                  }
                }}
                className="w-full bg-btn-primary text-white rounded-xl py-3 font-medium hover:opacity-90 transition-colors"
              >
                새로 시작하기
              </button>
            </div>

            <div className="relative py-4 flex items-center gap-4">
              <div className="h-[1px] bg-divider flex-1" />
              <span className="text-[10px] text-text-hint font-bold">OR</span>
              <div className="h-[1px] bg-divider flex-1" />
            </div>

            <div className="space-y-2">
              <input id="invite-code" placeholder="상대방 초대 코드" className="w-full bg-white/50 border border-border-point rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-divider text-center text-sm placeholder:text-text-hint" />
              <button
                onClick={async () => {
                  const code = (document.getElementById('invite-code') as HTMLInputElement).value.trim();
                  if (!code) return alert('코드를 입력해주세요!');
                  try {
                    const snap = await getDoc(doc(db, 'couples', code));
                    if (!snap.exists()) return alert('유효하지 않은 코드입니다.');
                    
                    const data = snap.data();
                    if (data.members.length >= 2) return alert('이미 인원이 가득 찼습니다.');
                    
                    await updateDoc(doc(db, 'couples', code), {
                      members: [...data.members, user.uid],
                      updatedAt: serverTimestamp()
                    });
                  } catch (e) {
                    alert('참가 중 오류가 발생했습니다.');
                  }
                }}
                className="w-full bg-white text-btn-primary border border-divider rounded-xl py-2 text-sm font-medium hover:bg-surface-card transition-colors"
              >
                초대 코드로 참가하기
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-app-bg to-surface-card">
      {/* Background Ornaments */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-icon-bg/30 rounded-full blur-[100px] opacity-70" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-white/40 rounded-full blur-[80px] opacity-50" />

      {/* Header */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-transparent z-40">
        <button onClick={() => setSidebarOpen(true)} className="p-3 bg-white/40 backdrop-blur-md rounded-2xl text-accent-impact shadow-sm">
          <Menu size={20} />
        </button>
        <span className="font-cursive text-3xl font-medium tracking-tight text-accent-impact">LoveDays</span>
        <button 
          onClick={() => setNotifModalOpen(true)}
          className="p-3 bg-white/40 backdrop-blur-md rounded-2xl text-accent-impact shadow-sm relative"
        >
          <Bell size={20} className="fill-current opacity-80" />
          {hasUnread && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-btn-primary rounded-full border border-white" />
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="px-6 pb-32 h-full relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && profile && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-10"
            >
              {/* D-Day Counter */}
              <div className="text-center pt-4">
                <p className="text-text-hint font-serif uppercase tracking-[0.3em] text-[10px] mb-4 opacity-70 text-center">
                  SINCE {format(parseISO(profile.startDate), 'yyyy. MM. dd')}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span className="font-serif text-3xl text-accent-impact/60 mb-2 italic">D+</span>
                  <h1 className="text-[100px] leading-none font-serif font-black text-accent-impact tracking-tighter">
                    {differenceInDays(new Date(), parseISO(profile.startDate)) + 1}
                  </h1>
                  <span className="text-xl font-bold text-accent-impact/50 ml-1">일</span>
                </div>
                <p className="text-text-secondary text-xs font-bold mt-2 tracking-widest opacity-60 text-center">우리 함께한 날들</p>
              </div>

              {/* Profiles Section */}
              <div className="flex items-center justify-center gap-8 py-2 w-full">
                <div className="flex flex-col items-center gap-3">
                  <motion.div 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setImageAction({ field: 'partner1Image' })}
                    className="relative p-1 rounded-full border border-border-point bg-white shadow-xl shadow-divider/50 cursor-pointer"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white">
                      {profile.partner1Image ? (
                        <img src={profile.partner1Image} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-surface-card flex items-center justify-center text-text-hint">🌸</div>
                      )}
                    </div>
                  </motion.div>
                  <span className="text-sm font-bold text-text-primary px-3 py-1 bg-white/50 rounded-full">{profile.partner1}</span>
                </div>

                <div className="w-10 h-10 bg-btn-primary rounded-full flex items-center justify-center shadow-lg shadow-btn-primary/20 shrink-0">
                  <Heart size={18} className="text-white fill-white" />
                </div>

                <div className="flex flex-col items-center gap-3">
                  <motion.div 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setImageAction({ field: 'partner2Image' })}
                    className="relative p-1 rounded-full border border-border-point bg-white shadow-xl shadow-divider/50 cursor-pointer"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white">
                      {profile.partner2Image ? (
                        <img src={profile.partner2Image} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-surface-card flex items-center justify-center text-text-hint">🌙</div>
                      )}
                    </div>
                  </motion.div>
                  <span className="text-sm font-bold text-text-primary px-3 py-1 bg-white/50 rounded-full">{profile.partner2}</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="w-full max-w-sm space-y-4">
                {nextMilestone && (
                  <div 
                    onClick={() => setActiveTab('dday')}
                    className="bg-white/60 backdrop-blur-sm border border-border-point rounded-[24px] p-5 flex items-center justify-between shadow-sm group hover:bg-white transition-colors duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-icon-bg/30 rounded-full flex items-center justify-center text-lg">💍</div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">{nextMilestone.days}일 기념일까지</p>
                        <p className="text-[10px] text-text-hint font-medium tracking-tight">우리의 소중한 {nextMilestone.days}번째 약속</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-accent-impact">D-{nextMilestone.remaining}</span>
                      <span className="text-[8px] text-text-hint font-bold">{nextMilestone.date}</span>
                    </div>
                  </div>
                )}

                <motion.div 
                  onClick={() => setActiveTab('calendar')}
                  className="bg-white/80 border border-border-point rounded-[32px] overflow-hidden shadow-md cursor-pointer hover:translate-y-[-2px] transition-transform"
                >
                  <div className="bg-surface-card/50 p-4 border-b border-divider/40 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} className="text-accent-impact" />
                      <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">오늘의 기억</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-hint">{format(new Date(), 'yyyy. MM. dd')}</span>
                  </div>
                  
                  <div className="p-6">
                    {todayMemory ? (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-text-primary mb-1 flex items-center gap-2">
                              {todayMemory.title || (todayMemory.content.slice(0, 15) + (todayMemory.content.length > 15 ? '...' : ''))}
                              <span className="text-lg">❤️</span>
                            </h4>
                            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 italic">
                              {todayMemory.content}
                            </p>
                          </div>
                          {todayMemory.images?.[0] && (
                            <img src={todayMemory.images[0]} className="w-14 h-14 object-cover rounded-xl" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-text-hint italic mb-3">아직 오늘의 기록이 없어요.</p>
                        <p className="text-[10px] font-bold text-accent-impact uppercase tracking-widest underline underline-offset-4">기록하러 가기</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Quote */}
              <div className="text-center py-6 px-10">
                <motion.p 
                  onClick={() => updateTextField('frameQuote', profile.frameQuote || '"Every moment with you is a gift from the universe."')}
                  className="font-serif text-text-hint italic text-sm md:text-base leading-relaxed cursor-pointer opacity-80"
                >
                  {profile.frameQuote || '"Every moment with you is a gift from the universe."'}
                </motion.p>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && profile && (
            <MemoryCalendar 
              profile={profile} 
              selectedDate={selectedDate} 
              setSelectedDate={setSelectedDate}
              currentMonth={calendarMonth}
              setCurrentMonth={setCalendarMonth}
            />
          )}

          {activeTab === 'settings' && profile && (
            <SettingsView profile={profile} onSignOut={logOut} />
          )}

          {activeTab === 'dday' && profile && (
            <DDayView profile={profile} />
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Nav */}
      <footer className="fixed bottom-0 left-0 right-0 p-5 z-40 bg-gradient-to-t from-app-bg to-transparent pointer-events-none">
        <nav className="max-w-[280px] mx-auto flex items-center justify-between pointer-events-auto px-3 py-2 bg-white/60 backdrop-blur-xl rounded-[40px] shadow-2xl shadow-divider/50 border border-white">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
              activeTab === 'calendar' ? "bg-btn-primary text-white scale-110" : "bg-app-bg text-text-hint hover:text-btn-secondary"
            )}
          >
            <Camera size={20} />
          </button>
          
          <button 
            onClick={() => setActiveTab('home')}
            className="w-13 h-13 bg-btn-primary text-white rounded-full flex items-center justify-center shadow-xl shadow-btn-primary/30 scale-110 active:scale-100 transition-all font-bold"
          >
            <Heart size={24} className="fill-white" />
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
              activeTab === 'settings' ? "bg-btn-primary text-white scale-110" : "bg-app-bg text-text-hint hover:text-btn-secondary"
            )}
          >
            <Settings size={20} />
          </button>
        </nav>
      </footer>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white/95 backdrop-blur-2xl z-[60] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 pt-10 pb-24 no-scrollbar">
                <div className="mb-10 text-center relative px-2">
                  <div className="w-20 h-20 mx-auto bg-icon-bg rounded-full border-4 border-white shadow-xl shadow-divider/30 flex items-center justify-center text-3xl mb-3">💖</div>
                  <h2 className="text-xl font-serif italic text-accent-impact">Sweet Moments</h2>
                  <p className="text-[10px] text-text-hint font-medium tracking-tight mt-1">Record our precious days</p>
                  <button onClick={() => setSidebarOpen(false)} className="absolute top-0 right-0 bg-white/50 p-2 rounded-full text-text-hint hover:text-btn-primary transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-white/40 rounded-[28px] border border-white/50 shadow-sm">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <span className="text-[10px] font-black text-accent-impact uppercase tracking-[0.2em]">{format(sidebarMonth, 'MMMM yyyy')}</span>
                    <div className="flex gap-3">
                      <button onClick={() => setSidebarMonth(subMonths(sidebarMonth, 1))} className="text-text-hint hover:text-btn-primary transition-colors">
                        <ChevronLeft size={14} />
                      </button>
                      <button onClick={() => setSidebarMonth(addMonths(sidebarMonth, 1))} className="text-text-hint hover:text-btn-primary transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[8px] text-text-hint font-bold mb-2 opacity-60">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`} className={cn(i === 0 && "text-accent-impact", i === 6 && "text-blue-300")}>{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-text-secondary font-bold">
                    {Array.from({ length: startOfMonth(sidebarMonth).getDay() }).map((_, i) => <div key={`blank-${i}`} />)}
                    {eachDayOfInterval({
                      start: startOfMonth(sidebarMonth),
                      end: endOfMonth(sidebarMonth),
                    }).map((day) => {
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <button 
                          key={day.toISOString()} 
                          onClick={() => {
                            setSelectedDate(day);
                            setCalendarMonth(day);
                            setActiveTab('calendar');
                            setSidebarOpen(false);
                          }}
                          className={cn(
                            "py-1.5 rounded-lg transition-all relative group",
                            isSelected ? "bg-btn-primary text-white shadow-lg scale-105 z-10" : "hover:bg-white",
                            isToday && !isSelected && "text-btn-primary bg-btn-primary/5"
                          )}
                        >
                          {format(day, 'd')}
                          {isToday && !isSelected && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 bg-btn-primary rounded-full" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <nav className="space-y-2 px-1">
                  <SidebarItem label="Home" sub="Our universe" active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setSidebarOpen(false); }} />
                  <SidebarItem label="D-Day Counter" sub="Anniversaries" active={activeTab === 'dday'} onClick={() => { setActiveTab('dday'); setSidebarOpen(false); }} />
                  <SidebarItem label="Memory Lane" sub="Diary & Photos" active={activeTab === 'calendar'} onClick={() => { setActiveTab('calendar'); setSidebarOpen(false); }} />
                  <SidebarItem label="Settings" sub="App options" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} />
                </nav>

                <div className="mt-12 pt-6 border-t border-divider/50 px-2">
                  <button 
                    onClick={logOut}
                    className="w-full flex items-center gap-4 text-text-hint hover:text-red-400 transition-all p-3 rounded-2xl hover:bg-red-50/50"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <LogOut size={18} />
                    </div>
                    <span className="text-sm font-bold">로그아웃</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {imageAction.field && (
          <ImageActionModal
            isOpen={true}
            title={
              imageAction.field === 'partner1Image' ? `${profile?.partner1} 프로필 이미지` :
              imageAction.field === 'partner2Image' ? `${profile?.partner2} 프로필 이미지` :
              "커버 이미지 관리"
            }
            onClose={() => setImageAction({ field: null })}
            onUpload={() => updateImage(imageAction.field!)}
            onRemove={() => removeImage(imageAction.field!)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notifModalOpen && (
          <NotificationModal
            isOpen={true}
            onClose={() => setNotifModalOpen(false)}
            notifications={notifications}
            onMarkAsRead={markAsRead}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ label, sub, active, onClick }: { label: string, sub: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all",
        active ? "bg-surface-card shadow-sm" : "hover:bg-white/50"
      )}
    >
      <div className="text-left flex-1">
        <p className={cn("text-xs font-bold", active ? "text-accent-impact" : "text-text-primary")}>{label}</p>
        <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-0.5", active ? "text-accent-impact/60" : "text-text-hint")}>{sub}</p>
      </div>
      {active && <div className="w-1.5 h-1.5 bg-btn-primary rounded-full shrink-0 ml-2" />}
    </button>
  );
}

function DDayView({ profile }: { profile: Profile }) {
  const startDate = parseISO(profile.startDate);
  const now = new Date();
  const [customAnniversaries, setCustomAnniversaries] = useState<CustomAnniversary[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const q = query(collection(db, 'couples', profile.id, 'anniversaries'));
    return onSnapshot(q, (snap) => {
      const annivs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomAnniversary));
      setCustomAnniversaries(annivs);
    });
  }, [profile.id]);

  const addAnniversary = async () => {
    if (!newLabel || !newDate) return;
    try {
      await addDoc(collection(db, 'couples', profile.id, 'anniversaries'), {
        label: newLabel,
        date: newDate,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      // Add notification for the other partner
      const otherUserId = profile.members.find(m => m !== auth.currentUser?.uid);
      const isPartner1 = auth.currentUser?.uid === profile.members[0];
      const authorName = isPartner1 ? profile.partner1 : profile.partner2;
      
      if (otherUserId) {
        await addDoc(collection(db, 'couples', profile.id, 'notifications'), {
          type: 'anniversary_added',
          title: '새로운 기념일이 추가되었습니다!',
          message: `${authorName}님이 '${newLabel}' 기념일을 등록했어요. ✨`,
          userId: otherUserId,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setIsAddModalOpen(false);
      setNewLabel('');
    } catch (e) {
      console.error(e);
      alert('기념일 추가 중 오류가 발생했습니다.');
    }
  };

  const deleteAnniversary = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'couples', profile.id, 'anniversaries', id));
      setDeletingId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const milestones = [
    { days: 100, label: '100일' },
    { days: 200, label: '200일' },
    { days: 300, label: '300일' },
    { days: 365, label: '1주년' },
    { days: 400, label: '400일' },
    { days: 500, label: '500일' },
    { days: 600, label: '600일' },
    { days: 700, label: '700일' },
    { days: 730, label: '2주년' },
    { days: 800, label: '800일' },
    { days: 900, label: '900일' },
    { days: 1000, label: '1000일' },
    { days: 1095, label: '3주년' },
    { days: 1500, label: '1500일' },
    { days: 1825, label: '5주년' },
  ].map(m => ({
    ...m,
    dateValue: addDays(startDate, m.days - 1),
    isCustom: false
  }));

  const allEvents = [
    ...milestones,
    ...customAnniversaries.map(a => ({
      id: a.id,
      label: a.label,
      dateValue: parseISO(a.date),
      isCustom: true
    }))
  ].sort((a, b) => a.dateValue.getTime() - b.dateValue.getTime());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto pt-4 pb-24"
    >
      <div className="flex justify-between items-center mb-10 px-2">
        <div className="text-left">
          <h2 className="text-2xl font-serif italic text-accent-impact">Our Milestones</h2>
          <p className="text-[10px] text-text-hint font-black uppercase tracking-[0.2em]">우리가 함께 걷는 길</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-accent-impact shadow-lg shadow-divider/50 hover:bg-btn-primary hover:text-white transition-all transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {allEvents.map((event, idx) => {
          const isPast = differenceInDays(now, event.dateValue) >= 0;
          const diff = differenceInDays(event.dateValue, now);

          return (
            <div 
              key={event.isCustom ? event.id : `milestone-${idx}`}
              className={cn(
                "p-6 rounded-[32px] border transition-all duration-300 flex items-center justify-between",
                isPast 
                  ? "bg-white border-border-point shadow-md opacity-100" 
                  : "bg-white/40 border-transparent text-text-hint grayscale-[0.5]"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner",
                  isPast ? "bg-icon-bg/20" : "bg-app-bg"
                )}>
                  {event.isCustom ? '⭐' : (isPast ? '💍' : '⏳')}
                </div>
                <div>
                  <h4 className="text-sm font-black text-text-primary">{event.label}</h4>
                  <p className="text-[10px] font-bold text-text-hint tracking-tight">{format(event.dateValue, 'yyyy. MM. dd')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  {isPast ? (
                    <span className="text-[10px] font-black text-accent-impact/50 uppercase tracking-widest">Completed</span>
                  ) : (
                    <span className="text-sm font-black text-accent-impact">D-{diff + 1}</span>
                  )}
                </div>
                {event.isCustom && (
                  <button 
                    onClick={() => setDeletingId(event.id!)}
                    className="p-2 text-text-hint hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-border-point"
            >
              <h3 className="text-xl font-serif mb-6 text-center text-text-primary italic">Add Special Day</h3>
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
                    disabled={!newLabel || !newDate}
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

// Separate components for better organization

function MemoryCalendar({ profile, selectedDate, setSelectedDate, currentMonth, setCurrentMonth }: { 
  profile: Profile, 
  selectedDate: Date | null, 
  setSelectedDate: (d: Date | null) => void,
  currentMonth: Date,
  setCurrentMonth: (d: Date) => void
}) {
  const coupleId = profile.id;
  const [memories, setMemories] = useState<Record<string, Memory>>({});
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'couples', coupleId, 'memories'));
    
    // Real-time listener for ALL memories of this couple
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mems: Record<string, Memory> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as Memory;
        mems[data.date] = { id: doc.id, ...data };
      });
      setMemories(mems);
      setLoading(false);
    }, (error) => {
      console.error("Memories snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coupleId]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const monthStartDay = startOfMonth(currentMonth).getDay();
  const blanks = Array.from({ length: monthStartDay }, (_, i) => i);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 h-full flex flex-col">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-8 px-1">
        <h2 className="text-2xl font-serif italic text-text-primary">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 bg-white/50 rounded-2xl text-accent-impact hover:bg-white transition-colors shadow-sm"><ChevronLeft size={20} /></button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 bg-white/50 rounded-2xl text-accent-impact hover:bg-white transition-colors shadow-sm"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 mb-4 opacity-50">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] font-black text-text-hint uppercase tracking-widest">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2.5 mb-10">
        {blanks.map(b => <div key={`blank-${b}`} />)}
        {daysInMonth.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasMemory = !!memories[dateStr];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all",
                isSelected ? "bg-btn-primary text-white dreamy-shadow scale-110 z-10" : "bg-white/40 text-text-secondary hover:bg-white",
                isToday && !isSelected && "ring-2 ring-btn-primary/30"
              )}
            >
              <span className="text-sm font-bold">{format(day, 'd')}</span>
              {hasMemory && <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shadow-sm", isSelected ? "bg-white" : "bg-btn-primary")} />}
            </button>
          );
        })}
      </div>

      {/* Selected Date Entry Modal overlay */}
      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-[70] flex flex-col pt-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="flex-1 bg-gradient-to-b from-app-bg to-white rounded-t-[48px] shadow-2xl relative flex flex-col overflow-hidden"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif italic text-text-primary">{format(selectedDate, 'MM월 dd일')}</h3>
                  <p className="text-[10px] text-text-hint font-black uppercase tracking-widest mt-1">Daily Memory Entry</p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-text-hint"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-32 no-scrollbar">
                <MemoryEditor
                  date={format(selectedDate, 'yyyy-MM-dd')}
                  profile={profile}
                  existingMemory={memories[format(selectedDate, 'yyyy-MM-dd')]}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SNS Style Feed Section */}
      <div className="flex-1 min-h-0 flex flex-col mt-4">
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="w-8 h-8 bg-accent-impact/10 rounded-xl flex items-center justify-center text-accent-impact">
            <Heart size={16} className="fill-current" />
          </div>
          <h3 className="text-xl font-serif italic text-text-primary">Our Memories</h3>
          <div className="ml-auto flex items-center gap-2">
             <span className="text-[10px] font-black text-text-hint uppercase tracking-widest">{Object.keys(memories).length} Stories</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6 pb-20 no-scrollbar">
          {(Object.entries(memories) as [string, Memory][])
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, memory]) => (
              <motion.div 
                key={memory.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-divider/20 border border-white"
              >
                {/* Author Bar */}
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
                      <p className="text-xs font-black text-text-primary">{memory.authorName || 'Someone'}</p>
                      <p className="text-[9px] text-text-hint font-bold uppercase tracking-widest">{format(parseISO(date), 'MMMM do, yyyy')}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDate(parseISO(date))} className="p-2 text-text-hint bg-app-bg rounded-xl">
                    <Menu size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {(memory.title || memory.content) && (
                    <div className="space-y-2">
                      {memory.title && (
                        <h4 className="text-base font-bold text-text-primary leading-tight px-1">
                          {memory.title}
                        </h4>
                      )}
                      {memory.content && (
                        <p className="text-sm text-text-secondary leading-relaxed px-1 font-medium italic">
                          "{memory.content}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Images Grid */}
                  {memory.images && memory.images.length > 0 && (
                    <div className={cn(
                      "grid gap-2 rounded-2xl overflow-hidden",
                      memory.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                      {memory.images.slice(0, 4).map((img, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setPreviewImage(img)}
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interaction Footer */}
                <div className="px-5 py-4 bg-app-bg/30 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-accent-impact">
                    <Heart size={16} className="fill-current" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Infinite Love</span>
                  </div>
                </div>
              </motion.div>
            ))}
          
          {Object.keys(memories).length === 0 && (
            <div className="text-center py-20 bg-white/30 rounded-[40px] border-2 border-dashed border-border-point">
               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">📸</div>
               <h4 className="text-sm font-bold text-text-primary mb-1">No memories yet</h4>
               <p className="text-[10px] text-text-hint font-medium">Start capturing your precious days together</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal 
            src={previewImage} 
            onClose={() => setPreviewImage(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MemoryEditor({ date, profile, existingMemory }: { date: string, profile: Profile, existingMemory?: Memory }) {
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
        await addDoc(collection(db, 'couples', coupleId, 'memories'), {
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
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert('기록 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSaving(true);
        try {
          const compressed = await compressImage(file);
          setImages([...images, compressed]);
        } catch (error) {
          console.error("Image upload error:", error);
          alert("이미지 처리 중 오류가 발생했습니다.");
        } finally {
          setSaving(false);
        }
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
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
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

      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden group shadow-sm">
            <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <button
              onClick={() => removeImage(i)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        <button
          onClick={addImage}
          className="w-24 h-24 rounded-2xl border-2 border-dashed border-border-point flex flex-col items-center justify-center text-text-hint hover:border-btn-secondary hover:text-btn-secondary hover:bg-white transition-all bg-surface-card/30"
        >
          <Camera size={24} />
          <span className="text-[10px] mt-1 font-bold uppercase">Insert</span>
        </button>
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

function SettingsView({ profile, onSignOut }: { profile: Profile, onSignOut: () => void }) {
  const [partner1, setPartner1] = useState(profile.partner1);
  const [partner2, setPartner2] = useState(profile.partner2);
  const [startDate, setStartDate] = useState(profile.startDate);
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        partner1,
        partner2,
        startDate,
        updatedAt: serverTimestamp()
      });
      alert('설정이 저장되었습니다');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const updateTextField = async (field: 'frameHeadline' | 'frameDate' | 'frameQuote', current: string) => {
    if (!profile) return;
    const newVal = prompt('수정할 내용을 입력해주세요:', current);
    if (newVal === null || newVal === current) return;
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        [field]: newVal,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateImage = async (field: 'partner1Image' | 'partner2Image' | 'coverImage') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSaving(true);
        try {
          const compressed = await compressImage(file);
          await updateDoc(doc(db, 'couples', profile.id), {
            [field]: compressed,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error("Image upload error:", error);
          alert("이미지 업로드 중 오류가 발생했습니다.");
        } finally {
          setSaving(false);
        }
      }
    };
    input.click();
  };

  const updateCoverImage = () => updateImage('coverImage');

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pt-4 space-y-8">
      {/* Invite Code Section */}
      <div className="bg-btn-primary text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/20 rounded-full blur-xl" />
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">상대방 초대 코드</h3>
        <div className="flex items-center justify-between gap-4">
          <code className="text-xl font-bold bg-white/20 px-3 py-1 rounded-lg flex-1 overflow-hidden text-ellipsis">{profile.id}</code>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(profile.id);
              alert('코드가 복사되었습니다! 상대방에게 전달해주세요.');
            }}
            className="bg-white text-btn-primary px-3 py-1 rounded-lg text-xs font-bold"
          >
            COPY
          </button>
        </div>
        <p className="text-[10px] mt-2 opacity-70">이 코드를 상대방 앱의 '참가하기' 칸에 입력해주세요.</p>
      </div>

      <button 
        onClick={() => updateImage('coverImage')}
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
        <button onClick={() => updateImage('partner1Image')} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full border-4 border-white dreamy-shadow overflow-hidden bg-surface-card">
            {profile.partner1Image ? <img src={profile.partner1Image} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Plus className="m-auto text-text-hint" />}
          </div>
          <span className="text-xs text-text-hint font-medium">{profile.partner1} 사진</span>
        </button>
        <Heart className="w-6 h-6 text-icon-bg" />
        <button onClick={() => updateImage('partner2Image')} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full border-4 border-white dreamy-shadow overflow-hidden bg-surface-card">
            {profile.partner2Image ? <img src={profile.partner2Image} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Plus className="m-auto text-text-hint" />}
          </div>
          <span className="text-xs text-text-hint font-medium">{profile.partner2} 사진</span>
        </button>
      </div>

      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint uppercase ml-1">이름 1</label>
          <input value={partner1} onChange={e => setPartner1(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint uppercase ml-1">이름 2</label>
          <input value={partner2} onChange={e => setPartner2(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-hint uppercase ml-1">우리가 만난 날</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white/50 border border-divider rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-border-point" />
        </div>
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="w-full bg-btn-primary text-white rounded-xl py-3 font-medium hover:opacity-90 transition-colors mt-4"
        >
          {saving ? '저장 중...' : '정보 수정'}
        </button>
      </div>


      <button onClick={onSignOut} className="w-full text-text-hint text-sm hover:text-red-400 transition-colors py-4">
        시스템 로그아웃
      </button>
    </motion.div>
  );
}
