import {
  clearLensDeltaArrow,
  clearLensDeltaSign,
  formatClearLensCurrencyDelta,
  formatClearLensPercentDelta,
} from '../clearLensFormat';

describe('Clear Lens delta formatting', () => {
  it('formats positive values with an up arrow and plus sign', () => {
    expect(clearLensDeltaArrow(1)).toBe('▲');
    expect(clearLensDeltaSign(1)).toBe('+');
    expect(formatClearLensPercentDelta(1.234)).toBe('▲ +1.23%');
    expect(formatClearLensCurrencyDelta(123456)).toBe('▲ +₹1.23L');
  });

  it('formats negative values with a down arrow and minus sign', () => {
    expect(clearLensDeltaArrow(-1)).toBe('▼');
    expect(clearLensDeltaSign(-1)).toBe('-');
    expect(formatClearLensPercentDelta(-1.234)).toBe('▼ -1.23%');
    expect(formatClearLensCurrencyDelta(-1234)).toBe('▼ -₹1.2K');
  });

  it('uses a dash for non-finite values', () => {
    expect(formatClearLensPercentDelta(Number.NaN)).toBe('—');
    expect(formatClearLensCurrencyDelta(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
