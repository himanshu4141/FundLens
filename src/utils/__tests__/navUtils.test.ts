/**
 * Tests for navStaleness() — Fix 11 regression guard.
 *
 * navStaleness() drives the "as of [date]" / "today" label on fund cards
 * and the portfolio header stale banner. Tests verify correct label, stale,
 * and veryStale flags for boundary cases.
 */

import { navStaleness } from '@/src/utils/navUtils';

// Freeze time to a known date for all tests
const FAKE_TODAY = new Date('2026-03-26T10:00:00.000Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FAKE_TODAY);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('navStaleness()', () => {
  test('null latestNavDate → not stale, empty label', () => {
    const r = navStaleness(null);
    expect(r.stale).toBe(false);
    expect(r.veryStale).toBe(false);
    expect(r.label).toBe('');
  });

  test('latestNavDate = today → not stale, label = "today"', () => {
    const r = navStaleness('2026-03-26');
    expect(r.stale).toBe(false);
    expect(r.veryStale).toBe(false);
    expect(r.label).toBe('today');
  });

  test('latestNavDate 1 day ago → not stale (< 2 days threshold)', () => {
    const r = navStaleness('2026-03-25');
    expect(r.stale).toBe(false);
    expect(r.veryStale).toBe(false);
  });

  test('latestNavDate 2 days ago → stale but not veryStale', () => {
    const r = navStaleness('2026-03-24');
    expect(r.stale).toBe(true);
    expect(r.veryStale).toBe(false);
    expect(r.label).toContain('as of');
    expect(r.label).toContain('24');
    expect(r.label).toContain('Mar');
  });

  test('latestNavDate 4 days ago → stale AND veryStale', () => {
    const r = navStaleness('2026-03-22');
    expect(r.stale).toBe(true);
    expect(r.veryStale).toBe(true);
    expect(r.label).toContain('as of');
    expect(r.label).toContain('22');
  });

  test('label uses correct month abbreviation', () => {
    const r = navStaleness('2026-01-15');
    expect(r.label).toContain('Jan');
    expect(r.label).toContain('15');
  });

  test('label strips leading zero from day', () => {
    const r = navStaleness('2026-03-05');
    expect(r.label).toContain('5 Mar');
    expect(r.label).not.toContain('05');
  });
});
