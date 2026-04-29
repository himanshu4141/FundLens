import { formatCurrency } from '@/src/utils/formatting';

export function clearLensDeltaArrow(value: number): '▲' | '▼' {
  return value >= 0 ? '▲' : '▼';
}

export function clearLensDeltaSign(value: number): '+' | '-' {
  return value >= 0 ? '+' : '-';
}

export function formatClearLensPercentDelta(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${clearLensDeltaArrow(value)} ${clearLensDeltaSign(value)}${Math.abs(value).toFixed(decimals)}%`;
}

export function formatClearLensCurrencyDelta(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${clearLensDeltaArrow(value)} ${clearLensDeltaSign(value)}${formatCurrency(Math.abs(value))}`;
}
