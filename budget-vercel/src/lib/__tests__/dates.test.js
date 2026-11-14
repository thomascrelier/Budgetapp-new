import { test, expect } from 'vitest';
import { currentMonth, todayISO, addMonths, lastNMonths, monthOf } from '@/lib/dates';

test('Toronto month at 11:30pm on Oct 31 (UTC is Nov 1)', () => {
  const now = new Date('2026-11-01T03:30:00Z');
  expect(currentMonth(now)).toBe('2026-10');
  expect(todayISO(now)).toBe('2026-10-31');
});
test('addMonths and lastNMonths cross years', () => {
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect(addMonths('2026-11', 2)).toBe('2027-01');
  expect(lastNMonths(3, new Date('2026-02-10T12:00:00Z'))).toEqual(['2025-12', '2026-01', '2026-02']);
});
test('monthOf', () => {
  expect(monthOf('2026-03-15')).toBe('2026-03');
});
