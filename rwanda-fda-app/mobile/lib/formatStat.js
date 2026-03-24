import { Platform } from 'react-native';

/**
 * Readable dashboard counts (grouping) + stable width for number columns where supported.
 */
export function formatStat(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

/** Keeps digit columns aligned in stat grids (iOS/Android). */
export const tabularNumberStyle = Platform.OS === 'ios' ? { fontVariant: ['tabular-nums'] } : {};
