import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { ChevronLeft, ChevronRight, Copy, Flower2, Heart, ImageOff, MapPin, Navigation, PenLine, Pencil, Share2, Trash2, UserRound, X } from 'lucide-react';
import { differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth } from 'date-fns';
import { clsx } from 'clsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { Account, InvitationContent, dateText, isHoliday, timeLabel } from './data.ts';
import { useInvitation } from './store.ts';
import InvitationEditor from './InvitationEditor.tsx';
import { RibbonOpening } from './RibbonOpening.tsx';

interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  userId: string;
  createdAt: any;
}

interface Inv {
  c: InvitationContent;
  photos: Record<string, string>;
  gallery: string[];
}
const InvCtx = createContext<Inv | null>(null);
const useInv = () => useContext(InvCtx)!;

function Photo({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const { photos } = useInv();
  const src = photos[id];
  if (!src) {
    return (
      <div className={clsx('bg-inv-gray flex flex-col items-center justify-center gap-2 text-inv-ink/30 text-[12px]', className)}>
        <ImageOff size={22} strokeWidth={1.3} />
        사진 없음
      </div>
    );
  }
  return <img src={src} alt={alt} className={clsx('select-none', className)} draggable={false} />;
}

function Lines({ lines }: { lines: string[] }) {
  return <>{lines.map((l, i) => (l.trim() ? <p key={i}>{l}</p> : <div key={i} className="h-5" />))}</>;
}

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ en, ko }: { en: string; ko?: string }) {
  return (
    <div className="text-center mb-8">
      <p className="inv-smallcaps text-[13px] tracking-[0.15em] text-inv-rose">{en}</p>
      {ko && <h2 className="inv-batang text-[17px] text-inv-ink mt-2">{ko}</h2>}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[120] bg-black/75 text-white text-xs px-4 py-2.5 rounded-full whitespace-nowrap"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { show: setMsg, node };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function Petals() {
  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 9 + Math.random() * 7,
        size: 6 + Math.random() * 7,
        drift: (Math.random() - 0.5) * 120,
        key: i,
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {petals.map((p) => (
        <span
          key={p.key}
          className="inv-petal"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.7,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function Hero() {
  const { c: inv } = useInv();
  return (
    <section className="bg-white">
      <div className="pt-10 pb-8 text-center">
        <p className="inv-montserrat text-[10px] tracking-[0.25em] text-inv-ink/70">WEDDING INVITATION</p>
        <p className="inv-batang text-[19px] text-inv-ink mt-4 tracking-wide">
          {inv.groom.name} <span className="mx-2 text-inv-ink/60">|</span> {inv.bride.name}
        </p>
      </div>
      <div className="relative">
        <Photo id="main" alt="메인 사진" className="block w-full object-cover aspect-[4/5]" />
        <Petals />
      </div>
      <div className="text-center pt-10 pb-14">
        <p className="inv-script text-[38px] text-inv-ink leading-none">
          {inv.groom.english} and {inv.bride.english}
        </p>
        <p className="inv-batang text-[16px] text-inv-ink mt-8">{dateText(inv.date)}</p>
        <p className="inv-batang text-[16px] text-inv-ink mt-3">{inv.venue.name}</p>
      </div>
    </section>
  );
}

function Greeting() {
  const { c: inv } = useInv();
  return (
    <section className="bg-inv-gray pt-14 pb-10">
      <Reveal>
        <p className="inv-script text-[32px] text-inv-rose text-center mb-8">Invite you</p>
        <div className="inv-batang text-[15px] leading-[2.2] text-inv-ink text-center">
          <Lines lines={inv.greeting} />
        </div>
      </Reveal>
    </section>
  );
}

function Parents() {
  const { c: inv } = useInv();
  const row = (p: { father: string; mother: string; relation: string }, child: string) => (
    <div className="flex items-baseline justify-center gap-1.5 inv-batang text-[15px] text-inv-ink">
      <span>{p.father}</span>
      <span className="text-inv-ink/50">·</span>
      <span>{p.mother}</span>
      <span className="text-[13px] text-inv-ink/60 ml-0.5">의</span>
      <span className="text-[13px] text-inv-ink/60 w-7 text-center">{p.relation}</span>
      <span className="font-semibold w-10 text-left">{child}</span>
    </div>
  );
  return (
    <section className="bg-inv-gray pb-16">
      <Reveal className="space-y-3">
        {row(inv.parents.groom, inv.groom.first)}
        {row(inv.parents.bride, inv.bride.first)}
      </Reveal>
    </section>
  );
}

function Profiles() {
  const { c: inv } = useInv();
  const card = (side: 'groom' | 'bride') => {
    const person = inv[side];
    const prof = inv.profiles[side];
    return (
      <div className="flex-1 min-w-0">
        <div className="aspect-[3/4] overflow-hidden rounded-[6px] bg-inv-gray">
          <Photo id={side} alt={person.name} className="w-full h-full object-cover" />
        </div>
        <div className="text-center mt-5">
          <p className="inv-batang text-[15px] text-inv-ink">
            <span className="text-[12px] text-inv-rose mr-1.5">{side === 'groom' ? '신랑' : '신부'}</span>
            {person.name}
          </p>
          <p className="inv-batang text-[13px] text-inv-ink/70 mt-2">{prof.nickname}</p>
          <p className="inv-batang text-[13px] text-inv-ink/70 mt-1">{prof.tagline}</p>
        </div>
      </div>
    );
  };
  return (
    <section className="bg-white px-8 py-12">
      <Reveal className="flex gap-4">
        {card('groom')}
        {card('bride')}
      </Reveal>
    </section>
  );
}

function CalendarSection() {
  const { c: inv } = useInv();
  const wedding = parseISO(inv.date);
  const days = eachDayOfInterval({ start: startOfMonth(wedding), end: endOfMonth(wedding) });
  const lead = getDay(days[0]);
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <section className="bg-white pt-14 pb-6">
      <Reveal>
        <SectionLabel en="Calendar" />
        <p className="inv-batang text-[15px] text-inv-ink text-center font-semibold -mt-2 mb-10">{dateText(inv.date)}</p>
        <table className="mx-auto w-[300px] inv-garamond text-[15px] text-inv-ink">
          <thead>
            <tr>
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <th key={d} className={clsx('pb-5 inv-batang font-semibold', i === 0 && 'text-inv-rose')}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, wi) => (
              <tr key={wi}>
                {w.map((d, di) => {
                  if (!d) return <td key={di} className="h-12" />;
                  const isWedding = format(d, 'yyyy-MM-dd') === format(wedding, 'yyyy-MM-dd');
                  const red = di === 0 || isHoliday(d);
                  return (
                    <td key={di} className="h-12 text-center align-top">
                      <div className="relative inline-flex flex-col items-center">
                        <span
                          className={clsx(
                            'w-8 h-8 inline-flex items-center justify-center rounded-full',
                            isWedding && 'bg-inv-rose-soft text-white',
                            !isWedding && red && 'text-inv-rose'
                          )}
                        >
                          {format(d, 'd')}
                        </span>
                        {isWedding && (
                          <span className="absolute top-8 whitespace-nowrap text-[10px] inv-batang text-inv-rose">{timeLabel(inv.date)}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </section>
  );
}

function Countdown() {
  const { c: inv } = useInv();
  const target = useMemo(() => parseISO(inv.date).getTime(), [inv.date]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const parts = [
    { v: Math.floor(diff / 86400000), l: 'Days' },
    { v: Math.floor(diff / 3600000) % 24, l: 'Hour' },
    { v: Math.floor(diff / 60000) % 60, l: 'Min' },
    { v: Math.floor(diff / 1000) % 60, l: 'Sec' },
  ];
  const dday = differenceInCalendarDays(new Date(target), new Date(now));

  return (
    <section className="bg-white pt-10 pb-14">
      <Reveal>
        <div className="flex items-center justify-center gap-2">
          {parts.map((p, i) => (
            <React.Fragment key={p.l}>
              {i > 0 && <span className="text-inv-ink/40 text-xs">:</span>}
              <div className="w-[52px] py-2.5 rounded-md bg-inv-gray border border-black/[0.04] text-center">
                <p className="inv-garamond text-[22px] leading-none text-inv-rose">{String(p.v).padStart(2, '0')}</p>
                <p className="inv-garamond text-[10px] text-inv-rose/80 mt-1.5">{p.l}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
        <p className="inv-batang text-[14px] text-inv-ink text-center mt-8">
          {inv.groom.first} <Heart size={13} className="inline -mt-0.5 fill-inv-rose-soft text-inv-rose-soft" /> {inv.bride.first}{' '}
          {dday > 0 ? (
            <>결혼식까지 <b className="text-inv-rose">{dday}</b>일</>
          ) : dday === 0 ? (
            <>결혼식 <b className="text-inv-rose">당일</b>이에요</>
          ) : (
            <>결혼한 지 <b className="text-inv-rose">{-dday + 1}</b>일째</>
          )}
        </p>
      </Reveal>
    </section>
  );
}

function Gallery() {
  const { gallery: photos } = useInv();
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { if (idx >= photos.length) setIdx(0); }, [photos.length, idx]);
  if (photos.length === 0) return null;
  const go = (n: number) => {
    setDir(n > idx ? 1 : -1);
    setIdx((n + photos.length) % photos.length);
  };

  return (
    <section className="bg-white pt-14 pb-20">
      <Reveal>
        <SectionLabel en="Gallery" />
        <div className="relative px-1">
          <div className="flex justify-between items-center px-2 mb-3">
            <span className="text-[11px] inv-garamond text-white bg-black/15 rounded px-2 py-0.5">{idx + 1} / {photos.length}</span>
            <span className="text-[11px] text-white bg-black/25 rounded-md px-2.5 py-1">밀어서 더보기 ›››</span>
          </div>
          <div className="relative w-full aspect-[3/4] overflow-hidden">
            <AnimatePresence initial={false} custom={dir}>
              <motion.div
                key={photos[idx]}
                custom={dir}
                initial={{ x: `${dir * 100}%`, opacity: 0.4 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: `${-dir * 100}%`, opacity: 0.4 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50) go(idx + 1);
                  else if (info.offset.x > 50) go(idx - 1);
                }}
                onClick={() => setZoom(true)}
                className="absolute inset-0 cursor-zoom-in"
              >
                <Photo id={photos[idx]} alt={`사진 ${idx + 1}`} className="w-full h-full object-contain" />
              </motion.div>
            </AnimatePresence>
            <button onClick={() => go(idx - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 text-white/80 drop-shadow p-2" aria-label="이전 사진">
              <ChevronLeft size={26} strokeWidth={1.2} />
            </button>
            <button onClick={() => go(idx + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 text-white/80 drop-shadow p-2" aria-label="다음 사진">
              <ChevronRight size={26} strokeWidth={1.2} />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-3 px-1">
            {photos.map((p, i) => (
              <button
                key={p}
                onClick={() => go(i)}
                className={clsx('shrink-0 w-[52px] h-[52px] bg-inv-gray border transition-opacity', i === idx ? 'border-inv-ink/60 opacity-100' : 'border-transparent opacity-60')}
              >
                <Photo id={p} alt={`썸네일 ${i + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center"
            onClick={() => setZoom(false)}
          >
            <Photo id={photos[idx] ?? ''} alt="크게 보기" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-5 right-5 text-white/80" aria-label="닫기"><X size={26} /></button>
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-xs inv-garamond">{idx + 1} / {photos.length}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Location({ toast }: { toast: (m: string) => void }) {
  const { c: inv } = useInv();
  const q = encodeURIComponent(inv.venue.address);
  const navs = [
    { label: '네이버지도', href: `https://map.naver.com/p/search/${encodeURIComponent(inv.venue.name + ' ' + inv.venue.address)}`, color: '#03C75A' },
    { label: '카카오내비', href: `https://map.kakao.com/link/search/${encodeURIComponent(inv.venue.name)}`, color: '#FEE500' },
    { label: '티맵', href: `tmap://search?name=${encodeURIComponent(inv.venue.name)}`, color: '#3B6BFF' },
  ];
  return (
    <section className="bg-inv-gray pt-14 pb-6">
      <Reveal>
        <SectionLabel en="Location" ko="오시는 길" />
        <div className="text-center inv-batang text-inv-ink">
          <p className="text-[15px]">{inv.venue.address}</p>
          <p className="text-[15px] font-semibold mt-2">{inv.venue.name}</p>
          <button
            onClick={async () => { await copyText(inv.venue.address); toast('주소 복사 완료'); }}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-black/10 bg-white text-inv-ink/80"
          >
            <Copy size={12} /> 주소 복사
          </button>
        </div>
        <div className="mt-8 h-[260px] bg-white">
          <iframe
            title="오시는 길 지도"
            src={`https://maps.google.com/maps?q=${q}&z=16&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
        <div className="grid grid-cols-3 gap-px bg-black/5 border-y border-black/5">
          {navs.map((n) => (
            <a key={n.label} href={n.href} target="_blank" rel="noreferrer" className="bg-white py-3.5 flex items-center justify-center gap-1.5 text-[13px] text-inv-ink">
              <span className="w-4 h-4 rounded-[4px] inline-flex items-center justify-center" style={{ background: n.color }}>
                {n.label === '네이버지도' ? <MapPin size={10} className="text-white" /> : <Navigation size={9} className={n.label === '카카오내비' ? 'text-black' : 'text-white'} />}
              </span>
              {n.label}
            </a>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Transport() {
  const { c: inv } = useInv();
  if (inv.transport.length === 0) return null;
  return (
    <section className="bg-inv-gray pt-4 pb-16 px-8">
      <Reveal className="space-y-6">
        {inv.transport.map((t, ti) => (
          <div key={ti} className="border-t border-black/10 pt-5">
            <p className="inv-batang text-[15px] font-semibold text-inv-ink">{t.title}</p>
            {t.body.map((b, i) => <p key={i} className="inv-batang text-[14px] text-inv-ink/80 mt-2 leading-relaxed">{b}</p>)}
          </div>
        ))}
      </Reveal>
    </section>
  );
}

function Rsvp({ toast }: { toast: (m: string) => void }) {
  const { c: inv } = useInv();
  return (
    <section className="bg-white pt-16 pb-20">
      <Reveal className="text-center">
        <SectionLabel en="Rsvp" ko="참석 여부" />
        <div className="inv-batang text-[14px] leading-[2] text-inv-ink/90">
          <Lines lines={inv.rsvp} />
        </div>
        <button
          onClick={() => toast('보관용 청첩장이에요 💌')}
          className="mt-8 inline-flex items-center gap-1.5 px-6 py-3 rounded-full border border-black/10 text-[14px] text-inv-ink shadow-sm"
        >
          <UserRound size={15} /> 참석 여부 알리기
        </button>
      </Reveal>
    </section>
  );
}

function Interview() {
  const { c: inv } = useInv();
  return (
    <section className="bg-inv-beige pt-16 pb-20 px-8">
      <Reveal>
        <SectionLabel en="Interview" ko="인터뷰" />
        <div className="bg-white/70 rounded-lg px-6 py-8">
          <p className="inv-batang text-[15px] font-semibold text-inv-rose text-center mb-6">{inv.interview.question}</p>
          <div className="space-y-7">
            {inv.interview.answers.map((a, ai) => (
              <div key={ai} className="inv-batang text-[14px] leading-[1.9] text-inv-ink text-center">
                {a.lines.map((l, i) => (
                  <p key={i}>{i === 0 ? <><b>{a.speaker}</b> : {l}</> : l}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Wreath() {
  const { c: inv } = useInv();
  return (
    <section className="bg-inv-gray py-12">
      <Reveal className="text-center inv-batang text-inv-ink">
        <Flower2 size={26} strokeWidth={1.2} className="mx-auto mb-5 text-inv-rose-soft" />
        {inv.wreath.map((l, i) => (
          <p key={i} className={i === 0 ? 'text-[15px]' : 'text-[13px] text-inv-ink/70 mt-2'}>{l}</p>
        ))}
      </Reveal>
    </section>
  );
}

function AccountSection({ toast }: { toast: (m: string) => void }) {
  const { c: inv } = useInv();
  const [side, setSide] = useState<'groom' | 'bride'>(inv.accounts.groom.length ? 'groom' : 'bride');
  const list: Account[] = inv.accounts[side];
  return (
    <section className="bg-inv-gray pt-14 pb-20">
      <Reveal>
        <SectionLabel en="Account" ko="마음 전하실 곳" />
        <div className="inv-batang text-[14px] leading-[2] text-inv-ink/90 text-center pb-8">
          <Lines lines={inv.accountIntro} />
        </div>
        <div className="px-6">
          <div className="grid grid-cols-2 bg-white rounded-lg p-1 border border-black/5 mb-4">
            {(['groom', 'bride'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={clsx('py-2.5 text-[14px] rounded-md transition-colors inv-batang', side === s ? 'bg-inv-rose-soft text-white' : 'text-inv-ink/60')}
              >
                {s === 'groom' ? '신랑측' : '신부측'}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-lg border border-black/5 divide-y divide-black/5">
            {list.length === 0 && <p className="text-center text-[13px] text-inv-ink/50 py-8">등록된 계좌가 없어요</p>}
            {list.map((a, ai) => (
              <div key={ai} className="flex items-center justify-between px-5 py-4">
                <div className="inv-batang">
                  <p className="text-[13px] text-inv-ink">
                    <span className="text-inv-ink/50 mr-2">{a.role}</span>{a.name}
                  </p>
                  <p className="text-[13px] text-inv-ink/80 mt-1">{a.bank} {a.number}</p>
                </div>
                <button
                  onClick={async () => { await copyText(`${a.bank} ${a.number}`); toast(`${a.bank} ${a.number} 복사 완료`); }}
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md border border-black/10 text-inv-ink/80"
                >
                  <Copy size={12} /> 복사
                </button>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Guestbook({ coupleId, user, toast }: { coupleId: string; user: User; toast: (m: string) => void }) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.displayName || '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'couples', coupleId, 'guestbook'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GuestbookEntry))),
      (err) => handleFirestoreError(err, OperationType.LIST, `couples/${coupleId}/guestbook`)
    );
  }, [coupleId]);

  const submit = async () => {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'couples', coupleId, 'guestbook'), {
        name: name.trim(),
        message: message.trim(),
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setMessage('');
      setOpen(false);
      toast('축하글이 등록되었어요');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `couples/${coupleId}/guestbook`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 축하글을 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'guestbook', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `couples/${coupleId}/guestbook/${id}`);
    }
  };

  return (
    <section className="bg-inv-beige pt-14 pb-14">
      <Reveal>
        <SectionLabel en="Guest book" ko="방명록" />
        <div className="inv-batang text-[14px] leading-[2] text-inv-ink/90 text-center -mt-3 mb-8">
          <p>따뜻한 마음이 담긴 축하의 글을 남겨주시면</p>
          <p>소중한 추억으로 간직하겠습니다</p>
        </div>
        <div className="px-6 space-y-3">
          {entries.length === 0 && <p className="text-center text-[13px] text-inv-ink/60 py-6">가장 먼저 축하글을 남겨보세요. 😊</p>}
          {entries.map((e) => (
            <div key={e.id} className="bg-white rounded-lg px-5 py-4 border border-black/5">
              <div className="flex items-center justify-between">
                <p className="inv-batang text-[13px] font-semibold text-inv-ink">{e.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-inv-ink/40">{e.createdAt?.toDate ? format(e.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span>
                  {e.userId === user.uid && (
                    <button onClick={() => remove(e.id)} className="text-inv-ink/30 hover:text-red-400" aria-label="삭제"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <p className="inv-batang text-[13px] text-inv-ink/80 mt-2 whitespace-pre-wrap leading-relaxed">{e.message}</p>
            </div>
          ))}
          <div className="text-center pt-4">
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-white border border-black/10 text-[14px] text-inv-ink shadow-sm">
              <PenLine size={14} /> 글쓰기
            </button>
          </div>
        </div>
      </Reveal>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-[430px] rounded-t-2xl sm:rounded-2xl p-6"
            >
              <div className="flex justify-between items-center mb-5">
                <p className="inv-batang text-[16px] text-inv-ink">축하글 남기기</p>
                <button onClick={() => setOpen(false)} className="text-inv-ink/50"><X size={20} /></button>
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="이름" className="w-full border border-black/10 rounded-lg px-4 py-3 text-[14px] mb-3 outline-none focus:border-inv-rose-soft" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="축하의 글을 남겨주세요" className="w-full border border-black/10 rounded-lg px-4 py-3 text-[14px] outline-none resize-none focus:border-inv-rose-soft" />
              <button onClick={submit} disabled={saving || !name.trim() || !message.trim()} className="w-full mt-4 py-3.5 rounded-lg bg-inv-rose-soft text-white text-[14px] disabled:opacity-40">
                {saving ? '등록 중…' : '등록하기'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Footer({ toast }: { toast: (m: string) => void }) {
  const { c: inv } = useInv();
  const share = async () => {
    const title = `${inv.groom.name} ❤️ ${inv.bride.name} 결혼합니다.`;
    if (navigator.share) {
      try { await navigator.share({ title, url: inv.shareUrl }); } catch { /* 사용자가 취소 */ }
    } else {
      await copyText(inv.shareUrl);
      toast('청첩장 링크를 복사했어요');
    }
  };
  return (
    <section className="bg-inv-beige pt-6 pb-16 text-center">
      {inv.shareUrl && <button onClick={share} className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-white border border-black/10 text-[14px] text-inv-ink shadow-sm">
        <Share2 size={14} /> 공유하기
      </button>}
      <p className="text-[10px] text-inv-ink/40 mt-10 inv-montserrat tracking-wider">
        {inv.groom.english.toUpperCase()} & {inv.bride.english.toUpperCase()} · {format(parseISO(inv.date), 'yyyy.MM.dd')}
      </p>
    </section>
  );
}

export default function WeddingInvitation({ coupleId, user }: { coupleId: string; user: User }) {
  const { show, node } = useToast();
  const { loading, error, content, gallery, photos } = useInvitation(coupleId);
  const [editing, setEditing] = useState(false);
  // 청첩장 탭을 열 때마다 리본 오프닝을 한 번 보여 줌
  const [showOpening, setShowOpening] = useState(true);
  const closeOpening = useCallback(() => setShowOpening(false), []);
  const ctx = useMemo(() => ({ c: content, photos, gallery }), [content, photos, gallery]);
  const noPhotos = !loading && Object.keys(photos).length === 0;

  return (
    <motion.div
      key="invitation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="-mx-6 lg:mx-0 flex justify-center lg:pt-2"
    >
      <div className="inv-root relative w-full max-w-[430px] bg-white shadow-xl shadow-divider/40 overflow-hidden">
        {loading ? (
          <div className="py-40 flex justify-center">
            <div className="w-8 h-8 border-2 border-inv-rose-soft border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-32 px-10 text-center">
            <p className="text-3xl mb-4">💌</p>
            <p className="text-[14px] text-inv-ink leading-relaxed">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-6 px-5 py-2.5 rounded-full border border-black/10 text-[13px] text-inv-ink/80">
              다시 불러오기
            </button>
          </div>
        ) : (
          <InvCtx.Provider value={ctx}>
            {showOpening && (
              <RibbonOpening groom={content.groom.name} bride={content.bride.name} onDone={closeOpening} />
            )}
            <button
              onClick={() => setEditing(true)}
              className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full bg-white/90 border border-black/10 text-inv-ink/80 shadow-sm"
            >
              <Pencil size={12} /> 편집
            </button>
            {noPhotos && (
              <button onClick={() => setEditing(true)} className="block w-full bg-inv-beige text-[12px] text-inv-rose pt-12 pb-3">
                아직 사진이 없어요. 편집 → 사진에서 올려주세요.
              </button>
            )}
            <Hero />
            <Greeting />
            <Parents />
            <Profiles />
            <CalendarSection />
            <Countdown />
            <Gallery />
            <Location toast={show} />
            <Transport />
            <Rsvp toast={show} />
            <Interview />
            <Wreath />
            <AccountSection toast={show} />
            <Guestbook coupleId={coupleId} user={user} toast={show} />
            <Footer toast={show} />
          </InvCtx.Provider>
        )}
      </div>
      <AnimatePresence>
        {editing && (
          <InvitationEditor
            coupleId={coupleId}
            content={content}
            gallery={gallery}
            photos={photos}
            onClose={() => setEditing(false)}
            toast={show}
          />
        )}
      </AnimatePresence>
      {node}
    </motion.div>
  );
}
