import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export function ImagePreviewModal({ images, index, onClose }: { images: string[], index: number, onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  const go = (n: number) => setCurrent((n + images.length) % images.length);
  if (!images.length) return null;
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-4 lg:p-10" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-white flex items-center gap-2 font-bold"
        >
          <span className="text-[10px] uppercase tracking-widest">Close</span>
          <X size={24} />
        </button>
        <motion.img 
          key={current}
          src={images[current]} 
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) go(current + 1);
            else if (info.offset.x > 50) go(current - 1);
          }}
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl select-none" 
          referrerPolicy="no-referrer"
          draggable={false}
        />
        {images.length > 1 && (
          <>
            <button onClick={() => go(current - 1)} aria-label="이전 사진" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => go(current + 1)} aria-label="다음 사진" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center">
              <ChevronRight size={20} />
            </button>
            <p className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-white/70 text-xs font-bold">{current + 1} / {images.length}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
