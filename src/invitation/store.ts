// 청첩장 내용과 사진을 Firestore에 저장하고 불러옵니다.
// couples/{coupleId}/invitation/main       → { content, gallery: 사진 id 목록, updatedAt }
// couples/{coupleId}/invitationPhotos/{id} → { data: 압축된 이미지 data URL, updatedAt }
// 보안 규칙상 커플 멤버(로그인한 두 사람)만 읽고 쓸 수 있습니다.
import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { InvitationContent, withDefaults } from './data.ts';

// Firestore 문서 한도(1MB)보다 여유 있게
const MAX_DATA_URL_LENGTH = 950_000;

export interface InvitationState {
  loading: boolean;
  // 불러오기에 실패했을 때의 이유 (권한 없음 등)
  error: string | null;
  content: InvitationContent;
  gallery: string[];
  photos: Record<string, string>;
}

export function useInvitation(coupleId: string): InvitationState {
  const [state, setState] = useState<InvitationState>({
    loading: true,
    error: null,
    content: withDefaults(undefined),
    gallery: [],
    photos: {},
  });
  const [docLoaded, setDocLoaded] = useState(false);
  const [photosLoaded, setPhotosLoaded] = useState(false);

  useEffect(() => {
    const path = `couples/${coupleId}/invitation/main`;
    return onSnapshot(
      doc(db, 'couples', coupleId, 'invitation', 'main'),
      (snap) => {
        const data = snap.data();
        setState((s) => ({ ...s, content: withDefaults(data?.content), gallery: data?.gallery ?? [] }));
        setDocLoaded(true);
      },
      (err) => {
        setState((s) => ({ ...s, error: describeError(err) }));
        setDocLoaded(true);
        try { handleFirestoreError(err, OperationType.GET, path); } catch { /* 화면에 안내를 띄웠으므로 무시 */ }
      }
    );
  }, [coupleId]);

  useEffect(() => {
    const path = `couples/${coupleId}/invitationPhotos`;
    return onSnapshot(
      collection(db, 'couples', coupleId, 'invitationPhotos'),
      (snap) => {
        const photos: Record<string, string> = {};
        snap.docs.forEach((d) => { photos[d.id] = d.data().data; });
        setState((s) => ({ ...s, photos }));
        setPhotosLoaded(true);
      },
      (err) => {
        setState((s) => ({ ...s, error: describeError(err) }));
        setPhotosLoaded(true);
        try { handleFirestoreError(err, OperationType.LIST, path); } catch { /* 화면에 안내를 띄웠으므로 무시 */ }
      }
    );
  }, [coupleId]);

  return { ...state, loading: !(docLoaded && photosLoaded) };
}

function describeError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('permission') || msg.includes('PERMISSION')) {
    return '청첩장을 볼 권한이 없어요. Firebase 콘솔에서 Firestore 보안 규칙(firestore.rules)을 최신으로 배포했는지 확인해 주세요.';
  }
  if (msg.includes('offline') || msg.includes('unavailable')) return '인터넷 연결을 확인해 주세요.';
  return '청첩장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export async function saveInvitation(coupleId: string, content: InvitationContent, gallery: string[]) {
  const path = `couples/${coupleId}/invitation/main`;
  try {
    await setDoc(doc(db, 'couples', coupleId, 'invitation', 'main'), { content, gallery, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function savePhoto(coupleId: string, photoId: string, file: File) {
  const data = await compressForFirestore(file);
  const path = `couples/${coupleId}/invitationPhotos/${photoId}`;
  try {
    await setDoc(doc(db, 'couples', coupleId, 'invitationPhotos', photoId), { data, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deletePhoto(coupleId: string, photoId: string) {
  const path = `couples/${coupleId}/invitationPhotos/${photoId}`;
  try {
    await deleteDoc(doc(db, 'couples', coupleId, 'invitationPhotos', photoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function newGalleryId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// 긴 변을 줄이고 JPEG 품질을 낮춰 가며 문서 한도 안에 들어오게 압축합니다.
async function compressForFirestore(file: File): Promise<string> {
  const img = await loadImage(file);
  for (const maxSide of [1600, 1280, 1024]) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= MAX_DATA_URL_LENGTH) return url;
    }
  }
  throw new Error('사진이 너무 커서 저장할 수 없어요.');
}
