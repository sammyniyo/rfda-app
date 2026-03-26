/** Brand green RGB — use with greenAlpha() for consistent tints across screens. */
export const rgb = {
  fdaGreen: '13, 107, 82',
  fdaBlue: '30, 88, 138',
};

export function greenAlpha(a) {
  return `rgba(${rgb.fdaGreen}, ${a})`;
}

export function blueAlpha(a) {
  return `rgba(${rgb.fdaBlue}, ${a})`;
}

export const colors = {
  fdaGreen: '#0d6b52',
  fdaGreenDark: '#063d30',
  fdaGreenSoft: '#e8f4ef',
  fdaGold: '#b8892a',
  fdaGoldLight: '#f2e8c8',
  fdaBlue: '#1e588a',
  teal: '#0a7d76',
  purple: '#6b3a8e',
  rose: '#d25a7b',
  background: '#eef1f6',
  backgroundAlt: '#f6f8fb',
  card: '#ffffff',
  cardSoft: '#f8fafc',
  text: '#0f172a',
  textMuted: '#5c6570',
  textSubtle: '#8b95a1',
  border: '#e6e9ef',
  borderStrong: '#cfd6e0',
  danger: '#dc2626',
  success: '#059669',
  warning: '#d97706',
  black: '#000000',
  shadow: '#0b1220',
};

/** Solid headers + overlapping sheet (dashboard, profile). */
export const header = {
  gradientLight: [colors.fdaGreenDark, colors.fdaGreen, colors.teal],
  gradientDark: ['#031f19', colors.fdaGreenDark, '#0b1220'],
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.78)',
  textSubtle: 'rgba(255,255,255,0.55)',
  iconChip: 'rgba(255,255,255,0.14)',
  iconChipBorder: 'rgba(255,255,255,0.22)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
};
