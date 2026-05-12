import { C } from '@/constants/Theme';

// ─── Bouldering (V-scale) ─────────────────────────────────────────────────────

export const V_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5',
  'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14',
];

export const DISPLAY_GRADES = ['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export function gradeToNum(grade: string): number {
  if (!grade) return -1;
  if (grade === 'VB') return -1;
  const vMatch = grade.match(/^V(\d+)/i);
  if (vMatch) return parseInt(vMatch[1]);
  // YDS grades map via ydsToNum
  const yds = ydsToNum(grade);
  return yds >= 0 ? yds : -1;
}

export function numToGrade(num: number): string {
  if (num < 0) return 'VB';
  return `V${num}`;
}

export function gradeColor(grade: string): string {
  if (!grade) return C.textMuted;
  // Top rope grade: use YDS numeric
  if (grade.startsWith('5.')) {
    const n = ydsToNum(grade);
    if (n < 0) return C.textMuted;
    if (n < 4) return '#9CA3AF';    // 5.6–5.9
    if (n < 8) return '#3B82F6';    // 5.10
    if (n < 12) return '#8B5CF6';   // 5.11
    if (n < 16) return '#EC4899';   // 5.12
    if (n < 20) return '#EF4444';   // 5.13
    return '#EAB308';               // 5.14
  }
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
  attempts: Array<{ grade: string; result: string; route_type?: string | null }>
): string | null {
  const sends = attempts.filter(
    (a) => a.result === 'send' || a.result === 'flash'
  );
  if (!sends.length) return null;

  // Find the best V-grade attempt
  const vSends = sends.filter((a) => !a.grade.startsWith('5.'));
  const yNums = sends.filter((a) => a.grade.startsWith('5.')).map((a) => ydsToNum(a.grade)).filter((n) => n >= 0);
  const vNums = vSends.map((a) => gradeToNum(a.grade)).filter((n) => n >= 0);

  if (!vNums.length && !yNums.length) return null;

  // Prefer V-grade display if any V grades present
  if (vNums.length) return numToGrade(Math.max(...vNums));
  return numToYds(Math.max(...yNums));
}

export function maxGradeByType(
  attempts: Array<{ grade: string; result: string; route_type?: string | null }>,
  routeType: 'bouldering' | 'top_rope'
): string | null {
  const sends = attempts.filter(
    (a) => (a.result === 'send' || a.result === 'flash') &&
      ((routeType === 'bouldering' && !a.grade.startsWith('5.') && (a.route_type == null || a.route_type === 'bouldering'))
      || (routeType === 'top_rope' && (a.grade.startsWith('5.') || a.route_type === 'top_rope')))
  );
  if (!sends.length) return null;

  if (routeType === 'bouldering') {
    const nums = sends.map((a) => gradeToNum(a.grade)).filter((n) => n >= 0);
    return nums.length ? numToGrade(Math.max(...nums)) : null;
  } else {
    const nums = sends.map((a) => ydsToNum(a.grade)).filter((n) => n >= 0);
    return nums.length ? numToYds(Math.max(...nums)) : null;
  }
}

export function progressPct(currentGrade: string, goalGrade: string): number {
  const cur = gradeToNum(currentGrade);
  const goal = gradeToNum(goalGrade);
  if (cur < 0 || goal < 0 || goal === 0) return 0;
  const start = Math.max(0, goal - 4);
  return Math.min(1, Math.max(0, (cur - start) / (goal - start)));
}

// ─── Top Rope (YDS / Yosemite Decimal System) ────────────────────────────────

export const YDS_GRADES = [
  '5.6', '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c', '5.12d',
  '5.13a', '5.13b', '5.13c', '5.13d',
  '5.14a', '5.14b', '5.14c',
];

export const DISPLAY_YDS_GRADES = [
  '5.9', '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b',
];

/** Maps a YDS grade string → a monotonically increasing integer for comparison */
export function ydsToNum(grade: string): number {
  const idx = YDS_GRADES.indexOf(grade);
  return idx; // -1 if not found
}

export function numToYds(num: number): string {
  return YDS_GRADES[num] ?? '5.6';
}

// ─── Combined helpers ─────────────────────────────────────────────────────────

export type RouteType = 'bouldering' | 'top_rope';

export function gradesForType(routeType: RouteType): string[] {
  return routeType === 'bouldering' ? V_GRADES.slice(1) : YDS_GRADES;
}

export function displayGradesForType(routeType: RouteType): string[] {
  return routeType === 'bouldering' ? DISPLAY_GRADES : DISPLAY_YDS_GRADES;
}

export function gradeNumForType(grade: string, routeType: RouteType): number {
  return routeType === 'bouldering' ? gradeToNum(grade) : ydsToNum(grade);
}
