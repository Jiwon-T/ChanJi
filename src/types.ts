export interface Profile {
  id: string;
  partner1: string;
  partner2: string;
  startDate: string; // ISO format
  coverImage?: string;
  partner1Image?: string;
  partner2Image?: string;
  frameHeadline?: string;
  frameDate?: string;
  frameQuote?: string;
  members: string[];
  updatedAt: any;
}

export interface Memory {
  id: string;
  date: string; // YYYY-MM-DD
  title?: string;
  content: string;
  images: string[];
  userId: string;
  authorName?: string;
  authorImage?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CustomAnniversary {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
  userId: string;
  createdAt: any;
}

export interface CoupleNotification {
  id: string;
  type: 'memory_saved' | 'anniversary_added';
  title: string;
  message: string;
  userId: string;
  read: boolean;
  createdAt: any;
  // 알림을 눌렀을 때 이동할 기록/기념일 (예전 알림에는 없음)
  targetDate?: string; // YYYY-MM-DD
  targetId?: string;
}
