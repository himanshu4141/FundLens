import { resolveResponsiveLayout } from '@/src/utils/responsiveLayout';
import { DESKTOP_MIN_WIDTH } from '@/src/components/responsive/desktopBreakpoints';

describe('resolveResponsiveLayout', () => {
  describe('on native (isWeb=false)', () => {
    it('always returns "mobile" regardless of width', () => {
      expect(resolveResponsiveLayout(320, false)).toBe('mobile');
      expect(resolveResponsiveLayout(390, false)).toBe('mobile');
      expect(resolveResponsiveLayout(768, false)).toBe('mobile');
      expect(resolveResponsiveLayout(1024, false)).toBe('mobile');
      expect(resolveResponsiveLayout(1440, false)).toBe('mobile');
      expect(resolveResponsiveLayout(2560, false)).toBe('mobile');
    });
  });

  describe('on web (isWeb=true)', () => {
    it('returns "mobile" below the desktop breakpoint', () => {
      expect(resolveResponsiveLayout(320, true)).toBe('mobile');
      expect(resolveResponsiveLayout(390, true)).toBe('mobile');
      expect(resolveResponsiveLayout(768, true)).toBe('mobile');
      expect(resolveResponsiveLayout(DESKTOP_MIN_WIDTH - 1, true)).toBe('mobile');
    });

    it('returns "desktop" at and above the desktop breakpoint', () => {
      expect(resolveResponsiveLayout(DESKTOP_MIN_WIDTH, true)).toBe('desktop');
      expect(resolveResponsiveLayout(DESKTOP_MIN_WIDTH + 1, true)).toBe('desktop');
      expect(resolveResponsiveLayout(1440, true)).toBe('desktop');
      expect(resolveResponsiveLayout(2560, true)).toBe('desktop');
    });

    it('uses 1024 as the breakpoint', () => {
      expect(DESKTOP_MIN_WIDTH).toBe(1024);
    });

    it('handles edge widths cleanly', () => {
      expect(resolveResponsiveLayout(0, true)).toBe('mobile');
      expect(resolveResponsiveLayout(1023, true)).toBe('mobile');
      expect(resolveResponsiveLayout(1024, true)).toBe('desktop');
    });
  });
});
