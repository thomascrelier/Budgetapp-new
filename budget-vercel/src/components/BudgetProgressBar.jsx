'use client';

import { motion } from 'framer-motion';
import { formatMoney } from './AnimatedNumber';

function getState(status, pct) {
  if (status === 'exceeded' || pct >= 100) return 'over';
  if (status === 'warning' || pct >= 75) return 'near';
  return 'ok';
}

const FILL = { over: 'bg-negative', near: 'bg-warning', ok: 'bg-accent' };
const TRACK = { over: 'bg-negative/10', near: 'bg-warning/10', ok: 'bg-surface-hover' };

export default function BudgetProgressBar({ category, spent, limit, percentage, status }) {
  const pct = Number.isFinite(Number(percentage)) ? Number(percentage) : 0;
  const state = getState(status, pct);
  const pctLabel = `${Math.round(pct)}% used`;
  const stateLabel = state === 'over' ? 'Over budget' : state === 'near' ? 'Near limit' : null;

  return (
    <div className="py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 truncate font-medium text-text-primary">{category}</span>
        <span className="tabular text-sm text-text-secondary">
          {formatMoney(spent)} <span className="text-text-muted">of</span> {formatMoney(limit)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${category} budget`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(Math.round(pct), 100)}
        aria-valuetext={`${formatMoney(spent)} of ${formatMoney(limit)}, ${pctLabel}${stateLabel ? `, ${stateLabel.toLowerCase()}` : ''}`}
        className={`h-2 overflow-hidden rounded-full ${TRACK[state]}`}
      >
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: Math.min(pct, 100) / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full w-full origin-left rounded-full ${FILL[state]}`}
        />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span className="tabular text-text-muted">{pctLabel}</span>
        {stateLabel && (
          <span className={`font-medium ${state === 'over' ? 'text-negative' : 'text-warning'}`}>{stateLabel}</span>
        )}
      </div>
    </div>
  );
}
