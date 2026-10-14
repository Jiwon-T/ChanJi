import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { showToast } from './toast.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Sign in failed:", error);
  }
}

export async function logOut() {
  await signOut(auth);
}

async function testConnection() {
  try {
    // Just a placeholder to verify connection on boot as per instructions
    const user = auth.currentUser;
    if (user) {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  showToast(friendlyMessage(operationType, errInfo.error), 'error');
  throw new Error(JSON.stringify(errInfo));
}

function friendlyMessage(op: OperationType, raw: string) {
  if (raw.includes('offline') || raw.includes('unavailable')) return '인터넷 연결을 확인해 주세요.';
  if (raw.includes('permission')) return '권한이 없어서 처리하지 못했어요.';
  const action = {
    [OperationType.CREATE]: '저장하지',
    [OperationType.UPDATE]: '수정하지',
    [OperationType.DELETE]: '삭제하지',
    [OperationType.WRITE]: '저장하지',
    [OperationType.LIST]: '불러오지',
    [OperationType.GET]: '불러오지',
  }[op];
  return `${action} 못했어요. 잠시 후 다시 시도해 주세요.`;
}
