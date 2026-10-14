import { useEffect, useState } from 'react';
import { cn } from '../lib/utils.ts';
import { Camera, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export function DeleteModal({ isOpen, onClose, onConfirm, title }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string }) {
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

export function ImageActionModal({ isOpen, onClose, onUpload, onRemove, title }: { 
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

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, title }: { 
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

// 브라우저 기본 confirm() 대신 쓰는 확인 창
export function ConfirmModal({ isOpen, title, message, confirmLabel = '확인', danger, onClose, onConfirm }: {
  isOpen: boolean,
  title: string,
  message?: string,
  confirmLabel?: string,
  danger?: boolean,
  onClose: () => void,
  onConfirm: () => void
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120] flex items-center justify-center p-6" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center border border-border-point"
      >
        <h3 className="text-lg font-bold mb-2 text-text-primary">{title}</h3>
        {message && <p className="text-text-secondary text-sm mb-8 leading-relaxed whitespace-pre-line">{message}</p>}
        <div className={cn('flex gap-3', !message && 'mt-6')}>
          <button onClick={onClose} className="flex-1 py-3 bg-app-bg rounded-2xl text-text-secondary font-medium hover:bg-surface-card transition-colors">취소</button>
          <button
            onClick={onConfirm}
            className={cn('flex-1 py-3 rounded-2xl font-medium text-white hover:opacity-90 transition-colors', danger ? 'bg-red-400' : 'bg-btn-primary')}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// 브라우저 기본 prompt() 대신 쓰는 글 입력 창
export function TextInputModal({ isOpen, title, initialValue, placeholder, multiline, onClose, onSubmit }: {
  isOpen: boolean,
  title: string,
  initialValue: string,
  placeholder?: string,
  multiline?: boolean,
  onClose: () => void,
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (isOpen) setValue(initialValue); }, [isOpen, initialValue]);
  if (!isOpen) return null;
  const inputCls = 'w-full bg-app-bg border border-divider/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-btn-primary/20 text-text-primary';
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120] flex items-center justify-center p-6" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[32px] p-7 max-w-sm w-full shadow-2xl border border-border-point"
      >
        <h3 className="text-lg font-bold mb-5 text-center text-text-primary">{title}</h3>
        {multiline ? (
          <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} rows={4} className={cn(inputCls, 'resize-none leading-relaxed')} />
        ) : (
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={inputCls} />
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-app-bg rounded-2xl text-text-secondary font-medium hover:bg-surface-card transition-colors">취소</button>
          <button onClick={() => onSubmit(value)} className="flex-1 py-3 bg-btn-primary text-white rounded-2xl font-medium hover:opacity-90 transition-colors">저장</button>
        </div>
      </motion.div>
    </div>
  );
}
