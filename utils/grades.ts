import { C } from '@/constants/Theme';

export const V_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5',
  'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12',
];

export const DISPLAY_GRADES = ['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export function gradeToNum(grade: string): number {
  if (!grade) return -1;
  if (grade === 'VB') return -1;
  const match = grade.match(/^V(\d+)/i);
  return match ? parseInt(match[1]) : -1;
}

export function numToGrade(num: number): string {
  if (num < 0) return 'VB';
  return `V${num}`;
}

export function gradeColor(grade: string): string {
  const n = gradeToNum(grade);
  if (n < 0) return C.textMuted;
  if (n <= 2) return '#9CA3AF';
  if (n <= 4) return '#3B82F6';
  if (n === 5) return '#8B5CF6';
  if (n === 6) return '#EC4899';
  if (n === 7) return '#EF4444';
  if (n === 8) return '#F97316';
  return '#EAB308';
}

export function maxGradeFromAttempts(
  attempts: Array<{ grade: string; result: string }>
): string | null {
  const sends = attempts.filter(
    (a) => a.result === 'send' || a.result === 'flash'
  );
  if (!sends.length) return null;
  const nums = sends.map((a) => gradeToNum(a.grade)).filter((n) => n >= 0);
  if (!nums.length) return null;
  return numToGrade(Math.max(...nums));
}

export function progressPct(currentGrade: string, goalGrade: string): number {
  const cur = gradeToNum(currentGrade);
  const goal = gradeToNum(goalGrade);
  if (cur < 0 || goal < 0 || goal === 0) return 0;
  const start = Math.max(0, goal - 4);
  return Math.min(1, Math.max(0, (cur - start) / (goal - start)));
}
