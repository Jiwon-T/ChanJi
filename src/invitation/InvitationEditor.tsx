import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ChevronDown, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { Account, InvitationContent, PhotoSlot } from './data.ts';
import { deletePhoto, newGalleryId, saveInvitation, savePhoto } from './store.ts';

interface Props {
  coupleId: string;
  content: InvitationContent;
  gallery: string[];
  photos: Record<string, string>;
  onClose: () => void;
  toast: (m: string) => void;
}

const inputCls = 'w-full border border-black/10 rounded-lg px-3 py-2.5 text-[14px] bg-white outline-none focus:border-inv-rose-soft';

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-inv-ink/60 mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </label>
  );
}

// 줄 단위 문구. 빈 줄은 문단 사이 간격이 됩니다.
function LinesField({ label, value, onChange, rows = 5 }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-inv-ink/60 mb-1">{label}</span>
      <textarea
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        rows={rows}
        className={clsx(inputCls, 'resize-y leading-relaxed')}
      />
    </label>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-black/5">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 text-[14px] font-semibold text-inv-ink">
        {title}
        <ChevronDown size={16} className={clsx('transition-transform text-inv-ink/40', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

function SmallBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx('inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md border', danger ? 'border-red-200 text-red-400' : 'border-black/10 text-inv-ink/70')}
    >
      {children}
    </button>
  );
}

function toLocalInput(iso: string) {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

export default function InvitationEditor({ coupleId, content, gallery, photos, onClose, toast }: Props) {
  const [draft, setDraft] = useState<InvitationContent>(() => structuredClone(content));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const [pendingSlot, setPendingSlot] = useState<PhotoSlot | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);

  const set = (fn: (d: InvitationContent) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await saveInvitation(coupleId, draft, gallery);
      toast('청첩장을 저장했어요');
      onClose();
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 사진은 고르는 즉시 저장됩니다. 갤러리 순서는 지금 저장된 문구와 함께 기록합니다.
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error && e.message.startsWith('사진') ? e.message : '사진을 저장하지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const setGallery = (ids: string[]) => saveInvitation(coupleId, content, ids);

  const onSlotFile = (file: File | undefined) => {
    if (!file || !pendingSlot) return;
    const slot = pendingSlot;
    run('사진 올리는 중…', () => savePhoto(coupleId, slot, file));
  };

  const onGalleryFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    run(`갤러리 사진 ${list.length}장 올리는 중…`, async () => {
      const ids = [...gallery];
      for (const f of list) {
        const id = newGalleryId();
        await savePhoto(coupleId, id, f);
        ids.push(id);
      }
      await setGallery(ids);
    });
  };

  const removeGallery = (id: string) =>
    run('삭제 중…', async () => {
      await setGallery(gallery.filter((g) => g !== id));
      await deletePhoto(coupleId, id);
    });

  const moveGallery = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= gallery.length) return;
    const ids = [...gallery];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run('순서 바꾸는 중…', () => setGallery(ids));
  };

  // 파일 이름(main, groom, bride, gallery-1 …)대로 한 번에 넣습니다. gallery-N 파일이 있으면 갤러리를 그 순서로 바꿉니다.
  const onBulkFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const slots: { slot: PhotoSlot; file: File }[] = [];
    const galleryFiles: { n: number; file: File }[] = [];
    for (const f of list) {
      const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
      if (base === 'main' || base === 'groom' || base === 'bride') slots.push({ slot: base, file: f });
      const m = base.match(/^gallery-(\d+)$/);
      if (m) galleryFiles.push({ n: Number(m[1]), file: f });
    }
    if (!slots.length && !galleryFiles.length) {
      toast('main, groom, bride, gallery-숫자 이름의 파일이 없어요');
      return;
    }
    galleryFiles.sort((a, b) => a.n - b.n);
    run(`사진 ${slots.length + galleryFiles.length}장 올리는 중…`, async () => {
      for (const { slot, file } of slots) await savePhoto(coupleId, slot, file);
      if (galleryFiles.length) {
        const ids: string[] = [];
        for (const { file } of galleryFiles) {
          const id = newGalleryId();
          await savePhoto(coupleId, id, file);
          ids.push(id);
        }
        const old = gallery;
        await setGallery(ids);
        for (const id of old) await deletePhoto(coupleId, id);
      }
      toast('사진을 모두 올렸어요');
    });
  };

  const accountsEditor = (side: 'groom' | 'bride') => {
    const list = draft.accounts[side];
    const update = (i: number, key: keyof Account, v: string) => set((d) => { d.accounts[side][i][key] = v; });
    return (
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-inv-ink">{side === 'groom' ? '신랑측' : '신부측'}</p>
        {list.map((a, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-inv-gray">
            <Field label="관계" value={a.role} onChange={(v) => update(i, 'role', v)} placeholder="아버지" />
            <Field label="이름" value={a.name} onChange={(v) => update(i, 'name', v)} />
            <Field label="은행" value={a.bank} onChange={(v) => update(i, 'bank', v)} />
            <Field label="계좌번호" value={a.number} onChange={(v) => update(i, 'number', v)} />
            <div className="col-span-2 text-right">
              <SmallBtn danger onClick={() => set((d) => { d.accounts[side].splice(i, 1); })}><Trash2 size={12} /> 삭제</SmallBtn>
            </div>
          </div>
        ))}
        <SmallBtn onClick={() => set((d) => { d.accounts[side].push({ role: '', name: '', bank: '', number: '' }); })}>
          <Plus size={12} /> 계좌 추가
        </SmallBtn>
      </div>
    );
  };

  const slotCard = (slot: PhotoSlot, label: string) => (
    <div className="flex-1 min-w-0">
      <button
        onClick={() => { setPendingSlot(slot); slotInput.current?.click(); }}
        className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-inv-gray border border-dashed border-black/15 flex items-center justify-center"
      >
        {photos[slot] ? <img src={photos[slot]} className="w-full h-full object-cover" /> : <ImagePlus size={20} className="text-inv-ink/30" />}
      </button>
      <p className="text-[11px] text-center text-inv-ink/60 mt-1">{label}</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="inv-root fixed inset-0 z-[100] bg-inv-gray flex flex-col"
    >
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-black/5">
        <button onClick={onClose} className="p-1 text-inv-ink/60" aria-label="닫기"><X size={22} /></button>
        <p className="text-[15px] font-semibold text-inv-ink">청첩장 편집</p>
        <button onClick={save} disabled={saving || !!busy} className="text-[14px] font-semibold text-inv-rose disabled:opacity-40">
          {saving ? '저장 중…' : '저장'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[480px] mx-auto p-4 space-y-3 pb-24">
          <Section title="사진" defaultOpen>
            <p className="text-[12px] text-inv-ink/50 leading-relaxed">사진은 고르는 즉시 저장돼요. 로그인한 두 사람만 볼 수 있어요.</p>
            <div className="flex gap-2">
              {slotCard('main', '메인')}
              {slotCard('groom', '신랑')}
              {slotCard('bride', '신부')}
            </div>
            <div>
              <p className="text-[12px] text-inv-ink/60 mb-2">갤러리 ({gallery.length}장)</p>
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((id, i) => (
                  <div key={id} className="relative aspect-square rounded-lg overflow-hidden bg-inv-gray">
                    {photos[id] && <img src={photos[id]} className="w-full h-full object-cover" />}
                    <span className="absolute top-1 left-1 text-[10px] bg-black/50 text-white rounded px-1">{i + 1}</span>
                    <div className="absolute bottom-0 inset-x-0 flex justify-between bg-black/40 text-white">
                      <button onClick={() => moveGallery(i, -1)} className="p-1.5" aria-label="앞으로"><ArrowLeft size={13} /></button>
                      <button onClick={() => removeGallery(id)} className="p-1.5" aria-label="삭제"><Trash2 size={13} /></button>
                      <button onClick={() => moveGallery(i, 1)} className="p-1.5" aria-label="뒤로"><ArrowRight size={13} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => galleryInput.current?.click()} className="aspect-square rounded-lg border border-dashed border-black/15 flex flex-col items-center justify-center gap-1 text-inv-ink/40 text-[11px]">
                  <Plus size={18} /> 추가
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-black/5">
              <button onClick={() => bulkInput.current?.click()} className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-black/10 text-[13px] text-inv-ink/80">
                <Upload size={14} /> 정리된 사진 한 번에 가져오기
              </button>
              <p className="text-[11px] text-inv-ink/40 mt-1.5 leading-relaxed">
                main, groom, bride, gallery-1, gallery-2 … 이름의 파일을 한꺼번에 고르면 제자리에 들어가요. gallery 파일이 있으면 갤러리를 그 순서로 바꿔요.
              </p>
            </div>
          </Section>

          <Section title="신랑 · 신부">
            <div className="grid grid-cols-3 gap-2">
              <Field label="신랑 이름" value={draft.groom.name} onChange={(v) => set((d) => { d.groom.name = v; })} />
              <Field label="부르는 이름" value={draft.groom.first} onChange={(v) => set((d) => { d.groom.first = v; })} />
              <Field label="영문" value={draft.groom.english} onChange={(v) => set((d) => { d.groom.english = v; })} />
              <Field label="신부 이름" value={draft.bride.name} onChange={(v) => set((d) => { d.bride.name = v; })} />
              <Field label="부르는 이름" value={draft.bride.first} onChange={(v) => set((d) => { d.bride.first = v; })} />
              <Field label="영문" value={draft.bride.english} onChange={(v) => set((d) => { d.bride.english = v; })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="신랑 별명" value={draft.profiles.groom.nickname} onChange={(v) => set((d) => { d.profiles.groom.nickname = v; })} />
              <Field label="신랑 한마디" value={draft.profiles.groom.tagline} onChange={(v) => set((d) => { d.profiles.groom.tagline = v; })} />
              <Field label="신부 별명" value={draft.profiles.bride.nickname} onChange={(v) => set((d) => { d.profiles.bride.nickname = v; })} />
              <Field label="신부 한마디" value={draft.profiles.bride.tagline} onChange={(v) => set((d) => { d.profiles.bride.tagline = v; })} />
            </div>
          </Section>

          <Section title="예식 일시 · 장소">
            <label className="block">
              <span className="block text-[12px] text-inv-ink/60 mb-1">일시</span>
              <input
                type="datetime-local"
                value={toLocalInput(draft.date)}
                onChange={(e) => e.target.value && set((d) => { d.date = `${e.target.value}:00+09:00`; })}
                className={inputCls}
              />
            </label>
            <Field label="장소 이름" value={draft.venue.name} onChange={(v) => set((d) => { d.venue.name = v; })} />
            <Field label="주소" value={draft.venue.address} onChange={(v) => set((d) => { d.venue.address = v; })} />
          </Section>

          <Section title="인사말">
            <LinesField label="한 줄씩 적어 주세요. 빈 줄은 문단 간격이 돼요." value={draft.greeting} onChange={(v) => set((d) => { d.greeting = v; })} rows={9} />
          </Section>

          <Section title="혼주">
            {(['groom', 'bride'] as const).map((side) => (
              <div key={side} className="grid grid-cols-3 gap-2">
                <Field label={`${side === 'groom' ? '신랑' : '신부'} 아버지`} value={draft.parents[side].father} onChange={(v) => set((d) => { d.parents[side].father = v; })} />
                <Field label="어머니" value={draft.parents[side].mother} onChange={(v) => set((d) => { d.parents[side].mother = v; })} />
                <Field label="관계" value={draft.parents[side].relation} onChange={(v) => set((d) => { d.parents[side].relation = v; })} />
              </div>
            ))}
          </Section>

          <Section title="교통 안내">
            {draft.transport.map((t, i) => (
              <div key={i} className="p-3 rounded-lg bg-inv-gray space-y-2">
                <Field label="제목" value={t.title} onChange={(v) => set((d) => { d.transport[i].title = v; })} />
                <LinesField label="내용" value={t.body} onChange={(v) => set((d) => { d.transport[i].body = v; })} rows={3} />
                <div className="text-right"><SmallBtn danger onClick={() => set((d) => { d.transport.splice(i, 1); })}><Trash2 size={12} /> 삭제</SmallBtn></div>
              </div>
            ))}
            <SmallBtn onClick={() => set((d) => { d.transport.push({ title: '', body: [] }); })}><Plus size={12} /> 안내 추가</SmallBtn>
          </Section>

          <Section title="참석 여부 문구">
            <LinesField label="문구" value={draft.rsvp} onChange={(v) => set((d) => { d.rsvp = v; })} rows={4} />
          </Section>

          <Section title="인터뷰">
            <Field label="질문" value={draft.interview.question} onChange={(v) => set((d) => { d.interview.question = v; })} />
            {draft.interview.answers.map((a, i) => (
              <div key={i} className="p-3 rounded-lg bg-inv-gray space-y-2">
                <Field label="답한 사람" value={a.speaker} onChange={(v) => set((d) => { d.interview.answers[i].speaker = v; })} />
                <LinesField label="답변" value={a.lines} onChange={(v) => set((d) => { d.interview.answers[i].lines = v; })} rows={6} />
                <div className="text-right"><SmallBtn danger onClick={() => set((d) => { d.interview.answers.splice(i, 1); })}><Trash2 size={12} /> 삭제</SmallBtn></div>
              </div>
            ))}
            <SmallBtn onClick={() => set((d) => { d.interview.answers.push({ speaker: '', lines: [] }); })}><Plus size={12} /> 답변 추가</SmallBtn>
          </Section>

          <Section title="화환 안내">
            <LinesField label="문구" value={draft.wreath} onChange={(v) => set((d) => { d.wreath = v; })} rows={2} />
          </Section>

          <Section title="마음 전하실 곳">
            <LinesField label="안내 문구" value={draft.accountIntro} onChange={(v) => set((d) => { d.accountIntro = v; })} rows={6} />
            {accountsEditor('groom')}
            {accountsEditor('bride')}
          </Section>

          <Section title="공유 링크">
            <Field label="공유하기 버튼이 보낼 링크 (비우면 버튼이 숨겨져요)" value={draft.shareUrl} onChange={(v) => set((d) => { d.shareUrl = v; })} />
          </Section>
        </div>
      </div>

      {busy && (
        <div className="fixed inset-0 z-[105] bg-white/70 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-inv-rose-soft border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-inv-ink/70">{busy}</p>
        </div>
      )}

      <input ref={slotInput} type="file" accept="image/*" className="hidden" onChange={(e) => { onSlotFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onGalleryFiles(e.target.files); e.target.value = ''; }} />
      <input ref={bulkInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onBulkFiles(e.target.files); e.target.value = ''; }} />
    </motion.div>
  );
}
