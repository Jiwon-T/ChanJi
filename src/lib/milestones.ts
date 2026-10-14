// 기념일 계산. 홈 화면과 D-Day 화면이 같은 규칙을 쓰도록 여기 한 곳에 모읍니다.
//
// 규칙
// - 만난 날이 1일째입니다. (홈 화면의 D+ 숫자와 같은 방식)
// - N일 기념일 = 만난 날 + (N - 1)일. 예: 1월 1일에 만났으면 100일은 4월 10일
// - N주년 = 만난 날과 같은 날짜 (윤년이어도 어긋나지 않게 연 단위로 더함)
import { addDays, addYears, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

export interface Milestone {
  key: string;
  label: string;
  date: Date;
  isCustom: boolean;
  customId?: string;
}

const DAY_STEPS = [
  ...Array.from({ length: 10 }, (_, i) => (i + 1) * 100), // 100 ~ 1000일
  ...Array.from({ length: 18 }, (_, i) => 1500 + i * 500), // 1500 ~ 10000일
];
const MAX_YEARS = 50;

export function dayCount(startDate: string, today = new Date()) {
  return differenceInCalendarDays(today, parseISO(startDate)) + 1;
}

export function buildMilestones(startDate: string, custom: { id: string; label: string; date: string }[] = []): Milestone[] {
  const start = startOfDay(parseISO(startDate));
  const list: Milestone[] = [
    ...DAY_STEPS.map((n) => ({ key: `d${n}`, label: `${n}일`, date: addDays(start, n - 1), isCustom: false })),
    ...Array.from({ length: MAX_YEARS }, (_, i) => ({
      key: `y${i + 1}`,
      label: `${i + 1}주년`,
      date: addYears(start, i + 1),
      isCustom: false,
    })),
    ...custom.map((c) => ({ key: `c${c.id}`, label: c.label, date: startOfDay(parseISO(c.date)), isCustom: true, customId: c.id })),
  ];
  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// 오늘 기준 남은 날. 0 이면 당일, 음수면 지난 기념일
export function daysUntil(date: Date, today = new Date()) {
  return differenceInCalendarDays(date, startOfDay(today));
}

export function ddayLabel(remaining: number) {
  if (remaining === 0) return 'D-Day';
  return remaining > 0 ? `D-${remaining}` : `D+${-remaining}`;
}

// 오늘이거나 앞으로 다가올 첫 기념일 (기본 기념일만)
export function nextMilestone(startDate: string, today = new Date()) {
  return buildMilestones(startDate).find((m) => daysUntil(m.date, today) >= 0) ?? null;
}
