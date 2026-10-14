// 청첩장 내용의 형태와 기본값.
// 실제 내용은 Firestore(couples/{id}/invitation/main)에 저장되고, 앱의 편집 화면에서 고칩니다.
// 아직 저장된 내용이 없을 때만 아래 기본값이 쓰입니다.
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export interface Account {
  role: string;
  name: string;
  bank: string;
  number: string;
}

export interface Person {
  name: string;
  first: string;
  english: string;
}

export interface Parents {
  father: string;
  mother: string;
  relation: string;
}

export interface InvitationContent {
  groom: Person;
  bride: Person;
  date: string; // ISO, 예: 2027-03-27T12:00:00+09:00
  venue: { name: string; address: string };
  greeting: string[];
  parents: { groom: Parents; bride: Parents };
  profiles: {
    groom: { nickname: string; tagline: string };
    bride: { nickname: string; tagline: string };
  };
  transport: { title: string; body: string[] }[];
  rsvp: string[];
  interview: { question: string; answers: { speaker: string; lines: string[] }[] };
  wreath: string[];
  accountIntro: string[];
  accounts: { groom: Account[]; bride: Account[] };
  shareUrl: string;
}

// 고정 사진 자리. 갤러리 사진은 별도 id 목록으로 관리합니다.
export const PHOTO_SLOTS = ['main', 'groom', 'bride'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export const defaultContent: InvitationContent = {
  groom: { name: '권혁찬', first: '혁찬', english: 'Hyeokchan' },
  bride: { name: '이지원', first: '지원', english: 'Jiwon' },
  date: '2027-03-27T12:00:00+09:00',
  venue: { name: '문창동성당', address: '대전 중구 대종로334번길 12' },
  greeting: [
    '저희 두 사람이',
    '평생을 함께하기 위해',
    '서로의 반려자가 되려 합니다.',
    '',
    '그 진실한 서약을 하는 자리에',
    '소중한 분들을 모십니다.',
    '자리하시어 축복해 주시면',
    '대단히 감사하겠습니다.',
  ],
  parents: {
    groom: { father: '권오성', mother: '양순희', relation: '아들' },
    bride: { father: '이치복', mother: '박은희', relation: '딸' },
  },
  profiles: {
    groom: { nickname: '파주 카리스마권', tagline: '신부의 든든한 해결사💕' },
    bride: { nickname: '대전 네네공주', tagline: '신랑의 웃음 제조기💕' },
  },
  transport: [{ title: '파주 → 버스', body: [] }],
  rsvp: [
    '참석의 부담은 가지지 말아주시고,',
    '정성껏 준비하기 위해 여쭙는 것이니,',
    '참석 여부를 알려주시면 감사하겠습니다.',
  ],
  interview: {
    question: 'Q. 배우자는 어떤 사람인가요?',
    answers: [
      {
        speaker: '혁찬',
        lines: [
          '제 신부는,',
          '긍정적이고 속이 깊은 사람입니다.',
          '제가 생각지도 못한 사소한',
          '부분까지 꼼꼼하게 잘 챙겨주는',
          '마음이 예쁜 사람입니다. 😊',
        ],
      },
      {
        speaker: '지원',
        lines: [
          '제 신랑은,',
          '저를 위해 많은 노력을 해주는',
          '다정하고 든든한 사람이에요.',
          '힘이 들 때 그의 한마디로',
          '저를 웃음 짓게 만들어주는',
          '유쾌하고 따듯한 사람입니다. 😃',
        ],
      },
    ],
  },
  wreath: ['화환은 정중히 사양합니다.', '축하의 마음만 감사히 받겠습니다.'],
  accountIntro: [
    '참석이 어려워 직접 축하를 전하지 못하는 분들을 위해',
    '계좌번호를 기재하였습니다.',
    '넓은 마음으로 양해 부탁드립니다.',
    '',
    '전해주시는 진심은 소중하게 간직하여',
    '좋은 부부의 모습으로 보답하겠습니다.',
  ],
  accounts: {
    groom: [],
    bride: [
      { role: '아버지', name: '이치복', bank: '하나은행', number: '648-910188-91207' },
      { role: '어머니', name: '박은희', bank: '하나은행', number: '625-910478-37507' },
    ],
  },
  shareUrl: 'https://makedear.com/mcard/view/mMUyDEZ',
};

// 저장된 내용에 빠진 항목이 있으면 기본값으로 채웁니다.
export function withDefaults(saved: Partial<InvitationContent> | undefined): InvitationContent {
  if (!saved) return defaultContent;
  return {
    ...defaultContent,
    ...saved,
    venue: { ...defaultContent.venue, ...saved.venue },
    parents: { ...defaultContent.parents, ...saved.parents },
    profiles: { ...defaultContent.profiles, ...saved.profiles },
    interview: { ...defaultContent.interview, ...saved.interview },
    accounts: { ...defaultContent.accounts, ...saved.accounts },
  };
}

export function timeLabel(iso: string) {
  const d = parseISO(iso);
  return format(d, d.getMinutes() ? 'a h시 m분' : 'a h시', { locale: ko });
}

export function dateText(iso: string) {
  return `${format(parseISO(iso), 'yyyy년 M월 d일 EEEE', { locale: ko })} ${timeLabel(iso)}`;
}

// 양력 고정 공휴일 (달력에서 빨간 날로 표시)
const FIXED_HOLIDAYS = new Set(['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25']);
export function isHoliday(d: Date) {
  return FIXED_HOLIDAYS.has(format(d, 'MM-dd'));
}
