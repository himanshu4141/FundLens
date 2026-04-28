import {
  clearLensDeltaArrow,
  clearLensDeltaSign,
  formatClearLensPercentDelta,
} from '../clearLensFormat';

describe('Clear Lens delta formatting', () => {
  it('formats positive values with an up arrow and plus sign', () => {
    expect(clearLensDeltaArrow(1)).toBe('▲');
    expect(clearLensDeltaSign(1)).toBe('+');
    expect(formatClearLensPercentDelta(1.234)).toBe('▲ +1.23%');
  });

  it('formats negative values with a down arrow and minus sign', () => {
    expect(clearLensDeltaArrow(-1)).toBe('▼');
    expect(clearLensDeltaSign(-1)).toBe('-');
    expect(formatClearLensPercentDelta(-1.234)).toBe('▼ -1.23%');
  });
});
