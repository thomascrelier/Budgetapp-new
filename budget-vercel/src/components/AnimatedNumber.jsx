'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

const MINUS = '−';

/**
 * One money format for the dashboard: whole dollars, true minus sign.
 * `signed` adds an explicit + for gains so direction never relies on color alone.
 */
export function formatMoney(value, { signed = false, decimals = 0 } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  })
    .format(n)
    .replace('-', MINUS);
}

/** Axis ticks: $1.2K, $15K, −$800. */
export function formatMoneyCompact(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
    .format(Number(value) || 0)
    .replace('-', MINUS);
}

function toNumber(value) {
  if (typeof value === 'string') return parseFloat(value.replace(/[^0-9.-]/g, ''));
  return value === null || value === undefined ? NaN : Number(value);
}

/**
 * Counts up to `value` once, the first time it scrolls into view.
 * Later value changes snap (no replaying the count on refetch or re-render).
 * Reduced motion: renders the final value immediately.
 * Screen readers get the final value only, never the intermediate frames.
 */
export default function AnimatedNumber({
  value,
  duration = 0.9,
  prefix = '',
  suffix = '',
  decimals = 2,
  format,
  className = '',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  const target = toNumber(value);
  const hasPlayed = useRef(false);
  // Start at 0 when the count will play, so there is no final-value flash before it begins.
  const [display, setDisplay] = useState(() => (reduceMotion || Number.isNaN(target) ? target : 0));

  useEffect(() => {
    if (Number.isNaN(target)) {
      setDisplay(target);
      return;
    }
    if (reduceMotion || hasPlayed.current) {
      setDisplay(target);
      return;
    }
    if (!isInView) return;

    hasPlayed.current = true;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / 1000 / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // expo out
      setDisplay(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setDisplay(target);
    };
  }, [isInView, target, duration, reduceMotion]);

  const render = (n) => {
    if (format) return format(n);
    if (Number.isNaN(n)) return '—';
    return `${prefix}${n.toLocaleString('en-CA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  };

  return (
    <span ref={ref} className={`tabular ${className}`}>
      <span aria-hidden="true">{render(display)}</span>
      <span className="sr-only">{render(target)}</span>
    </span>
  );
}
