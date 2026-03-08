'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export default function AnimatedNumber({
  value,
  duration = 0.8,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const numericValue = typeof value === 'string'
      ? parseFloat(value.replace(/[^0-9.-]/g, ''))
      : value;

    if (isNaN(numericValue)) {
      setDisplay(numericValue);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    function animate(currentTime) {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (numericValue - startValue) * eased;
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [isInView, value, duration]);

  const formatted = typeof display === 'number' && !isNaN(display)
    ? display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : display;

  return (
    <span ref={ref} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
