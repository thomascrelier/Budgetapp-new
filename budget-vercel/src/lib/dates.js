export const TZ = 'America/Toronto';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayISO(now = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function lastNMonths(n, now = new Date()) {
  const cur = currentMonth(now);
  return Array.from({ length: n }, (_, i) => addMonths(cur, i - (n - 1)));
}

export function monthOf(date) {
  return String(date).slice(0, 7);
}
