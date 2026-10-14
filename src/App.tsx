import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc, updateDoc, collection, query, where, writeBatch } from 'firebase/firestore';
import { auth, db, signIn, logOut, OperationType, handleFirestoreError } from './lib/firebase.ts';
import { Profile, Memory, CoupleNotification } from './types.ts';
import { Heart, Settings, LogOut, Menu, X, Camera, ChevronLeft, ChevronRight, Bell, Sparkles, Mail } from 'lucide-react';
import WeddingInvitation from './invitation/WeddingInvitation.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn, compressImage } from './lib/utils.ts';
import { ImageActionModal, TextInputModal } from './components/modals.tsx';
import { ToastHost } from './components/ToastHost.tsx';
import { showToast } from './lib/toast.ts';
import { dayCount, daysUntil, ddayLabel, nextMilestone as findNextMilestone } from './lib/milestones.ts';
import { NotificationModal } from './components/NotificationModal.tsx';
import { SidebarItem } from './components/SidebarItem.tsx';
import { DDayView } from './views/DDayView.tsx';
import { MemoryCalendar } from './views/MemoryCalendar.tsx';
import { SettingsView } from './views/SettingsView.tsx';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'settings' | 'dday' | 'invitation'>('home');
  const [todayMemories, setTodayMemories] = useState<Memory[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingQuote, setEditingQuote] = useState(false);
  const [openMemoryId, setOpenMemoryId] = useState<string | null>(null);
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
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `couples/${user.uid}`);
          });
        }
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'couples');
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
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `couples/${profile.id}/notifications`);
    });
  }, [profile, user]);

  useEffect(() => {
    if (!profile) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const q = query(collection(db, 'couples', profile.id, 'memories'), where('date', '==', todayStr));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory));
      list.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
      setTodayMemories(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `couples/${profile.id}/memories (today)`);
    });
  }, [profile]);

  const updateTextField = async (field: 'frameHeadline' | 'frameDate' | 'frameQuote', newVal: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'couples', profile.id), {
        [field]: newVal,
        updatedAt: serverTimestamp()
      });
      showToast('문구를 저장했어요');
    } catch (e) {
      console.error(e);
      showToast('문구를 저장하지 못했어요.', 'error');
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
          showToast('사진을 올리지 못했어요. 다시 시도해 주세요.', 'error');
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
      showToast('사진을 지우지 못했어요.', 'error');
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

  const openNotification = (n: CoupleNotification) => {
    if (!n.read) markAsRead(n.id);
    setNotifModalOpen(false);
    if (n.type === 'anniversary_added') {
      setActiveTab('dday');
      return;
    }
    setActiveTab('calendar');
    if (n.targetDate) {
      const d = parseISO(n.targetDate);
      setCalendarMonth(d);
      setOpenMemoryId(n.targetId ?? null);
      setSelectedDate(d);
    }
  };

  const markAllRead = async () => {
    if (!profile) return;
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'couples', profile.id, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch (e) {
      console.error(e);
      showToast('알림을 읽음으로 바꾸지 못했어요.', 'error');
    }
  };

  const clearReadNotifications = async () => {
    if (!profile) return;
    const read = notifications.filter((n) => n.read);
    if (!read.length) return;
    try {
      const batch = writeBatch(db);
      read.forEach((n) => batch.delete(doc(db, 'couples', profile.id, 'notifications', n.id)));
      await batch.commit();
      showToast(`읽은 알림 ${read.length}개를 지웠어요`);
    } catch (e) {
      console.error(e);
      showToast('알림을 지우지 못했어요.', 'error');
    }
  };

  const hasUnread = notifications.some(n => !n.read);

  const nextMilestone = React.useMemo(() => {
    if (!profile) return null;
    const m = findNextMilestone(profile.startDate);
    if (!m) return null;
    return { label: m.label, remaining: daysUntil(m.date), date: format(m.date, 'M월 d일 (EEE)', { locale: ko }) };
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
                  if (!p1 || !p2 || !date) return showToast('이름 두 개와 만난 날을 모두 입력해 주세요.', 'error');
                  
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
                  if (!code) return showToast('초대 코드를 입력해 주세요.', 'error');
                  try {
                    const snap = await getDoc(doc(db, 'couples', code));
                    if (!snap.exists()) return showToast('올바르지 않은 초대 코드예요.', 'error');
                    
                    const data = snap.data();
                    if (data.members.length >= 2) return showToast('이미 두 사람이 연결된 공간이에요.', 'error');
                    
                    await updateDoc(doc(db, 'couples', code), {
                      members: [...data.members, user.uid],
                      updatedAt: serverTimestamp()
                    });
                  } catch (e) {
                    showToast('참가하지 못했어요. 코드를 다시 확인해 주세요.', 'error');
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

  // 사이드바 내용: 모바일에서는 서랍(inDrawer), PC에서는 왼쪽에 항상 펼쳐 둡니다.
  const renderSidebarBody = (inDrawer: boolean) => (
    <div className="flex-1 overflow-y-auto px-6 pt-10 pb-10 no-scrollbar">
      <div className="mb-10 text-center relative px-2">
        <div className="w-20 h-20 mx-auto bg-icon-bg rounded-full border-4 border-white shadow-xl shadow-divider/30 flex items-center justify-center text-3xl mb-3">💖</div>
        <h2 className="text-xl font-serif italic text-accent-impact">Sweet Moments</h2>
        <p className="text-[10px] text-text-hint font-medium tracking-tight mt-1">Record our precious days</p>
        {inDrawer && <button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기" className="absolute top-0 right-0 bg-white/50 p-2 rounded-full text-text-hint hover:text-btn-primary transition-colors">
          <X size={18} />
        </button>}
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
            const isSelected = !!selectedDate && isSameDay(day, selectedDate);
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
        <SidebarItem label="Our Invitation" sub="Wedding Card" active={activeTab === 'invitation'} onClick={() => { setActiveTab('invitation'); setSidebarOpen(false); }} />
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
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-app-bg to-surface-card">
      {/* Background Ornaments */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-icon-bg/30 rounded-full blur-[100px] opacity-70" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-white/40 rounded-full blur-[80px] opacity-50" />

      {/* PC: 왼쪽 고정 사이드바 */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[300px] z-30 bg-white/70 backdrop-blur-2xl border-r border-white shadow-xl shadow-divider/20 flex-col overflow-hidden">
        {renderSidebarBody(false)}
      </aside>

      <div className="lg:pl-[300px]">

      {/* Header */}
      <header className="p-6 lg:px-10 flex items-center justify-between sticky top-0 bg-transparent z-40">
        <button onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기" className="p-3 bg-white/40 backdrop-blur-md rounded-2xl text-accent-impact shadow-sm lg:invisible">
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
      <main className="px-6 pb-32 lg:px-10 lg:pb-16 h-full relative z-10 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && profile && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-10 lg:grid lg:grid-cols-2 lg:gap-x-16 lg:gap-y-6 lg:items-center lg:pt-6"
            >
              {/* D-Day Counter */}
              <div className="text-center pt-4 lg:col-start-1">
                <p className="text-text-hint font-serif uppercase tracking-[0.3em] text-[10px] mb-4 opacity-70 text-center">
                  SINCE {format(parseISO(profile.startDate), 'yyyy. MM. dd')}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span className="font-serif text-3xl text-accent-impact/60 mb-2 italic">D+</span>
                  <h1 className="text-[100px] leading-none font-serif font-black text-accent-impact tracking-tighter">
                    {dayCount(profile.startDate)}
                  </h1>
                  <span className="text-xl font-bold text-accent-impact/50 ml-1">일</span>
                </div>
                <p className="text-text-secondary text-xs font-bold mt-2 tracking-widest opacity-60 text-center">우리 함께한 날들</p>
              </div>

              {/* Profiles Section */}
              <div className="flex items-center justify-center gap-8 py-2 w-full lg:col-start-1">
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
              <div className="w-full max-w-sm space-y-4 lg:max-w-md lg:justify-self-center lg:col-start-2 lg:row-start-1 lg:row-span-3">
                {nextMilestone && (
                  <div 
                    onClick={() => setActiveTab('dday')}
                    className="bg-white/60 backdrop-blur-sm border border-border-point rounded-[24px] p-5 flex items-center justify-between shadow-sm group hover:bg-white transition-colors duration-300 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-icon-bg/30 rounded-full flex items-center justify-center text-lg">💍</div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">
                          {nextMilestone.remaining === 0 ? `오늘은 우리의 ${nextMilestone.label}이에요 🎉` : `${nextMilestone.label} 기념일까지`}
                        </p>
                        <p className="text-[10px] text-text-hint font-medium tracking-tight">우리의 소중한 {nextMilestone.label}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-accent-impact">{ddayLabel(nextMilestone.remaining)}</span>
                      <span className="text-[9px] text-text-hint font-bold">{nextMilestone.date}</span>
                    </div>
                  </div>
                )}

                <motion.div
                  onClick={() => { setCalendarMonth(new Date()); setSelectedDate(new Date()); setActiveTab('calendar'); }}
                  className="bg-white/80 border border-border-point rounded-[32px] overflow-hidden shadow-md cursor-pointer hover:translate-y-[-2px] transition-transform"
                >
                  <div className="bg-surface-card/50 p-4 border-b border-divider/40 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} className="text-accent-impact" />
                      <span className="text-[11px] font-black text-text-secondary tracking-widest">
                        오늘의 기억{todayMemories.length > 1 && ` ${todayMemories.length}개`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-text-hint">{format(new Date(), 'yyyy. MM. dd')}</span>
                  </div>

                  <div className="p-6">
                    {todayMemories.length > 0 ? (
                      <div className="space-y-4">
                        {todayMemories.slice(0, 3).map((m) => (
                          <div key={m.id} className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-text-primary mb-1 flex items-center gap-2">
                                <span className="truncate">{m.title || (m.content.slice(0, 15) + (m.content.length > 15 ? '...' : '')) || '사진 기록'}</span>
                                <span className="text-lg shrink-0">❤️</span>
                              </h4>
                              {m.content && (
                                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 italic">{m.content}</p>
                              )}
                              <p className="text-[10px] text-text-hint font-bold mt-1">{m.authorName}</p>
                            </div>
                            {m.images?.[0] && (
                              <img src={m.images[0]} className="w-14 h-14 object-cover rounded-xl shrink-0" />
                            )}
                          </div>
                        ))}
                        {todayMemories.length > 3 && (
                          <p className="text-[11px] text-text-hint font-bold text-center">외 {todayMemories.length - 3}개 더 보기</p>
                        )}
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
              <div className="text-center py-6 px-10 lg:col-start-1 lg:py-2">
                <motion.p 
                  onClick={() => setEditingQuote(true)}
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
              openMemoryId={openMemoryId}
              setOpenMemoryId={setOpenMemoryId}
              currentMonth={calendarMonth}
              setCurrentMonth={setCalendarMonth}
            />
          )}

          {activeTab === 'settings' && profile && (
            <SettingsView 
              profile={profile} 
              onSignOut={logOut} 
              onImageAction={(field) => setImageAction({ field })}
            />
          )}

          {activeTab === 'dday' && profile && (
            <DDayView profile={profile} />
          )}

          {activeTab === 'invitation' && profile && user && (
            <WeddingInvitation coupleId={profile.id} user={user} />
          )}
        </AnimatePresence>
      </main>
      </div>

      {/* 모바일 하단 메뉴 (PC에서는 왼쪽 사이드바 사용) */}
      <footer className="fixed bottom-0 left-0 right-0 p-5 z-40 bg-gradient-to-t from-app-bg to-transparent pointer-events-none lg:hidden">
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
            onClick={() => setActiveTab('invitation')}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
              activeTab === 'invitation' ? "bg-btn-primary text-white scale-110" : "bg-app-bg text-text-hint hover:text-btn-secondary"
            )}
          >
            <Mail size={20} />
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white/95 backdrop-blur-2xl z-[60] shadow-2xl flex flex-col overflow-hidden lg:hidden"
            >
              {renderSidebarBody(true)}
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
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
            onClearRead={clearReadNotifications}
          />
        )}
      </AnimatePresence>

      <TextInputModal
        isOpen={editingQuote}
        title="홈 화면 문구 수정"
        initialValue={profile?.frameQuote || '"Every moment with you is a gift from the universe."'}
        multiline
        onClose={() => setEditingQuote(false)}
        onSubmit={(value) => {
          setEditingQuote(false);
          if (value !== (profile?.frameQuote || '')) updateTextField('frameQuote', value);
        }}
      />
    </div>
  );
}
