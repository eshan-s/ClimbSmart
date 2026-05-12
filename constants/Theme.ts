// ClimbSmart Design Tokens

export type ColorPalette = typeof DARK_COLORS;

export const DARK_COLORS = {
  // Backgrounds
  bg: '#0D0F14',
  surface: '#141720',
  card: '#191D28',
  cardHigh: '#1F2436',

  // Borders
  border: '#252A3A',
  borderLight: '#2E3448',

  // Brand — climbing orange
  primary: '#FF6535',
  primaryBg: 'rgba(255, 101, 53, 0.14)',
  primaryBorder: 'rgba(255, 101, 53, 0.35)',

  // Accent — sky blue
  accent: '#4B8EFF',
  accentBg: 'rgba(75, 142, 255, 0.14)',
  accentBorder: 'rgba(75, 142, 255, 0.35)',

  // Success — green
  success: '#3DC87A',
  successBg: 'rgba(61, 200, 122, 0.14)',
  successBorder: 'rgba(61, 200, 122, 0.35)',

  // Warning — amber
  warning: '#F5BC3C',
  warningBg: 'rgba(245, 188, 60, 0.14)',
  warningBorder: 'rgba(245, 188, 60, 0.35)',

  // Text
  text: '#F2F3F8',
  textSub: '#7E839E',
  textMuted: '#4A4E62',

  white: '#FFFFFF',
  black: '#000000',
};

export const LIGHT_COLORS: ColorPalette = {
  // Backgrounds
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardHigh: '#EEF0F8',

  // Borders
  border: '#DEE1F0',
  borderLight: '#E8EAFA',

  // Brand — same primary colour
  primary: '#FF6535',
  primaryBg: 'rgba(255, 101, 53, 0.10)',
  primaryBorder: 'rgba(255, 101, 53, 0.30)',

  accent: '#4B8EFF',
  accentBg: 'rgba(75, 142, 255, 0.10)',
  accentBorder: 'rgba(75, 142, 255, 0.30)',

  success: '#3DC87A',
  successBg: 'rgba(61, 200, 122, 0.10)',
  successBorder: 'rgba(61, 200, 122, 0.30)',

  warning: '#F5BC3C',
  warningBg: 'rgba(245, 188, 60, 0.10)',
  warningBorder: 'rgba(245, 188, 60, 0.30)',

  // Text
  text: '#111422',
  textSub: '#5A5E78',
  textMuted: '#9698AA',

  white: '#FFFFFF',
  black: '#000000',
};

// Default static export — keeps all existing imports working (dark by default)
export const C = DARK_COLORS;

export const S = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const F = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 34,
};
