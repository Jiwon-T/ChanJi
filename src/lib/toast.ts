// 화면 아래에 잠깐 뜨는 안내 메시지. 어디서든 showToast('…') 로 띄울 수 있어요.
export type ToastKind = 'info' | 'error';

export interface ToastDetail {
  message: string;
  kind: ToastKind;
}

const EVENT = 'app-toast';

export function showToast(message: string, kind: ToastKind = 'info') {
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT, { detail: { message, kind } }));
}

export function onToast(handler: (t: ToastDetail) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<ToastDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
