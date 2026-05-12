/**
 * Unit conversion utilities.
 * All stored values in Supabase are in SI units (kg, cm).
 * Display in imperial when the user has that preference.
 */

// ─── Weight ───────────────────────────────────────────────────────────────────

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

/** Format a weight value for display given units preference */
export function displayWeight(
  kgValue: number | null | undefined,
  units: 'imperial' | 'metric'
): { value: string; unit: string } {
  if (kgValue == null) return { value: '—', unit: units === 'imperial' ? 'lbs' : 'kg' };
  if (units === 'imperial') {
    return { value: String(kgToLbs(kgValue)), unit: 'lbs' };
  }
  return { value: String(kgValue), unit: 'kg' };
}

/** Parse a weight input string into kg for storage */
export function parseWeightInput(raw: string, units: 'imperial' | 'metric'): number | null {
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) return null;
  return units === 'imperial' ? lbsToKg(n) : n;
}

/** Produce the placeholder for a weight input field */
export function weightPlaceholder(units: 'imperial' | 'metric'): string {
  return units === 'imperial' ? 'e.g. 165 lbs' : 'e.g. 75 kg';
}

// ─── Height ───────────────────────────────────────────────────────────────────

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

/** Return feet + inches breakdown */
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return { ft, inches };
}

export function displayHeight(
  cmValue: number | null | undefined,
  units: 'imperial' | 'metric'
): { value: string; unit: string } {
  if (cmValue == null) return { value: '—', unit: units === 'imperial' ? 'ft' : 'cm' };
  if (units === 'imperial') {
    const { ft, inches } = cmToFtIn(cmValue);
    return { value: `${ft}'${inches}"`, unit: '' };
  }
  return { value: String(cmValue), unit: 'cm' };
}

/** Parse a height input string into cm for storage.
 *  Accepts: "180" (cm), "5'11\"" or "71" (inches) when in imperial */
export function parseHeightInput(raw: string, units: 'imperial' | 'metric'): number | null {
  if (!raw.trim()) return null;
  if (units === 'metric') {
    const n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? null : n;
  }
  // Imperial: try "5'11" or "5'11\"" format first
  const ftIn = raw.match(/(\d+)'?\s*(\d*)["']?/);
  if (ftIn) {
    const ft = parseInt(ftIn[1]);
    const inches = ftIn[2] ? parseInt(ftIn[2]) : 0;
    return inToCm(ft * 12 + inches);
  }
  // Plain number treated as total inches
  const n = parseFloat(raw);
  return isNaN(n) || n <= 0 ? null : inToCm(n);
}

export function heightPlaceholder(units: 'imperial' | 'metric'): string {
  return units === 'imperial' ? "e.g. 5'11\"" : 'e.g. 180 cm';
}
