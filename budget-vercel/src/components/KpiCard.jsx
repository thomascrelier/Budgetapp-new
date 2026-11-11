'use client';

import AnimatedNumber, { formatMoney } from './AnimatedNumber';

const TONE = {
  neutral: 'text-text-primary',
  positive: 'text-positive',
  negative: 'text-negative',
};

/**
 * One figure in a metric strip. Renders no card chrome of its own: the parent groups
 * related figures into a single surface so the page is not a grid of identical tiles.
 *
 * - `signed`: shows +/− so direction reads without color, and tints by sign.
 * - `tone`: explicit color when the meaning is not the sign (e.g. a card balance owed).
 * - `size`: 'md' for the headline figures, 'sm' for supporting ones.
 * - `annotation`: a short word after the figure ("owed", "overdrawn") that carries the meaning in text.
 */
export default function KpiCard({
  title,
  value,
  signed = false,
  tone,
  annotation,
  subtitle,
  size = 'md',
  className = '',
}) {
  const n = Number(value);
  const resolvedTone = tone ?? (signed && Number.isFinite(n) && n !== 0 ? (n > 0 ? 'positive' : 'negative') : 'neutral');

  return (
    <div className={`min-w-0 px-5 py-4 sm:px-6 sm:py-5 ${className}`}>
      <p className="text-sm text-text-tertiary">{title}</p>
      <p className={`mt-1 font-display leading-tight ${size === 'sm' ? 'text-2xl' : 'text-3xl'} ${TONE[resolvedTone]}`}>
        <AnimatedNumber value={value} format={(v) => formatMoney(v, { signed })} />
        {annotation && (
          <span className="ml-1.5 font-sans text-sm not-italic text-text-secondary">{annotation}</span>
        )}
      </p>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </div>
  );
}
