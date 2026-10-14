// 청첩장 오프닝: 종이 커버에 묶인 리본이 풀리면서 위아래로 열립니다.
// 탭하면 바로 열리고, 가만히 두면 잠시 뒤 저절로 열려요.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

type Phase = 'closed' | 'untie' | 'open';

const AUTO_OPEN_MS = 1800;
const PAPER = 'linear-gradient(180deg, #ffffff 0%, #f8f6f3 100%)';
// 크림색 새틴 리본 (위쪽 광택 → 아래쪽 그림자)
const RIBBON_BAND = 'linear-gradient(180deg,#fdf9f2 0%,#efe4d3 45%,#dccbb3 100%)';

function Bow({ phase }: { phase: Phase }) {
  const untied = phase !== 'closed';
  return (
    <svg viewBox="0 0 200 140" className="w-[150px] h-auto drop-shadow-[0_4px_7px_rgba(120,95,60,0.28)]" aria-hidden>
      <defs>
        <linearGradient id="satin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdf8ef" />
          <stop offset="0.45" stopColor="#eadcc6" />
          <stop offset="1" stopColor="#d2bea0" />
        </linearGradient>
        <linearGradient id="satinShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 리본 꼬리 */}
      <motion.g
        animate={untied ? { y: 30, opacity: 0, rotate: 0 } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeIn' }}
        style={{ originX: '100px', originY: '70px' }}
      >
        <path d="M96 74 L64 132 L76 124 L84 138 L104 78 Z" fill="url(#satin)" />
        <path d="M104 74 L136 132 L124 124 L116 138 L96 78 Z" fill="url(#satin)" />
      </motion.g>

      {/* 왼쪽 고리 */}
      <motion.g
        animate={untied ? { rotate: -35, scale: 0.4, opacity: 0, x: -30 } : { rotate: 0, scale: 1, opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '70px' }}
      >
        <path d="M100 70 C 70 20, 14 22, 22 62 C 28 92, 74 90, 100 70 Z" fill="url(#satin)" />
        <path d="M100 70 C 76 34, 34 34, 34 58 C 50 50, 76 58, 100 70 Z" fill="url(#satinShine)" />
      </motion.g>

      {/* 오른쪽 고리 */}
      <motion.g
        animate={untied ? { rotate: 35, scale: 0.4, opacity: 0, x: 30 } : { rotate: 0, scale: 1, opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '70px' }}
      >
        <path d="M100 70 C 130 20, 186 22, 178 62 C 172 92, 126 90, 100 70 Z" fill="url(#satin)" />
        <path d="M100 70 C 124 34, 166 34, 166 58 C 150 50, 124 58, 100 70 Z" fill="url(#satinShine)" />
      </motion.g>

      {/* 매듭 */}
      <motion.ellipse
        cx="100" cy="70" rx="15" ry="13" fill="#dac8ad"
        animate={untied ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeIn' }}
        style={{ originX: '100px', originY: '70px' }}
      />
      <motion.ellipse
        cx="96" cy="66" rx="6" ry="4" fill="#fff" opacity="0.35"
        animate={untied ? { opacity: 0 } : { opacity: 0.35 }}
      />
    </svg>
  );
}

export function RibbonOpening({ groom, bride, onDone }: { groom: string; bride: string; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('closed');

  // 기기에서 "동작 줄이기"를 켰으면 오프닝 생략
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onDone();
  }, [onDone]);

  // 가만히 두면 저절로 열림
  useEffect(() => {
    if (phase !== 'closed') return;
    const t = setTimeout(() => setPhase('untie'), AUTO_OPEN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // 매듭이 풀리고 나면 커버가 열리고, 다 열리면 사라짐
  useEffect(() => {
    if (phase === 'untie') {
      const t = setTimeout(() => setPhase('open'), 650);
      return () => clearTimeout(t);
    }
    if (phase === 'open') {
      const t = setTimeout(onDone, 1100);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  const opened = phase === 'open';
  const untied = phase !== 'closed';

  return (
    <div
      className="absolute inset-x-0 top-0 z-30 h-[100svh] max-h-[900px] overflow-hidden cursor-pointer select-none"
      onClick={() => phase === 'closed' && setPhase('untie')}
      role="button"
      aria-label="청첩장 열기"
    >
      {/* 위쪽 종이 */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 shadow-[0_6px_18px_rgba(120,80,80,0.12)]"
        style={{ background: PAPER }}
        animate={opened ? { y: '-102%' } : { y: 0 }}
        transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="absolute inset-x-0 bottom-16 text-center">
          <p className="inv-montserrat text-[10px] tracking-[0.3em] text-inv-ink/60">WEDDING INVITATION</p>
          <p className="inv-batang text-[19px] text-inv-ink mt-4 tracking-wide">
            {groom} <span className="mx-2 text-inv-ink/40">|</span> {bride}
          </p>
        </div>
      </motion.div>

      {/* 아래쪽 종이 */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-1/2 shadow-[0_-6px_18px_rgba(120,80,80,0.12)]"
        style={{ background: PAPER }}
        animate={opened ? { y: '102%' } : { y: 0 }}
        transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
      >
        <motion.p
          className="absolute inset-x-0 top-24 text-center inv-script text-[26px] text-[#b5a088]"
          animate={untied ? { opacity: 0 } : { opacity: [0.45, 1, 0.45] }}
          transition={untied ? { duration: 0.3 } : { duration: 2.2, repeat: Infinity }}
        >
          Tap to open
        </motion.p>
      </motion.div>

      {/* 가로 리본 띠: 매듭이 풀리면 양옆으로 빠짐 */}
      <motion.div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-1/2"
        style={{ background: RIBBON_BAND, boxShadow: '0 2px 5px rgba(120,95,60,0.18)' }}
        animate={untied ? { x: '-105%' } : { x: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeIn' }}
      />
      <motion.div
        className="absolute right-0 top-1/2 -translate-y-1/2 h-[18px] w-1/2"
        style={{ background: RIBBON_BAND, boxShadow: '0 2px 5px rgba(120,95,60,0.18)' }}
        animate={untied ? { x: '105%' } : { x: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeIn' }}
      />

      {/* 매듭 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[38%] pointer-events-none">
        <Bow phase={phase} />
      </div>

      {/* 건너뛰기 */}
      {!opened && (
        <button
          onClick={(e) => { e.stopPropagation(); onDone(); }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/35 text-white text-[12px] backdrop-blur-sm"
        >
          건너뛰기
        </button>
      )}
    </div>
  );
}
