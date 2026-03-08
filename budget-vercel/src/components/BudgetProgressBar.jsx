'use client';

import { motion } from 'framer-motion';

export default function BudgetProgressBar({ category, spent, limit, percentage, status }) {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusColor = () => {
    if (status === 'exceeded' || percentage >= 100) return 'bg-negative';
    if (status === 'warning' || percentage >= 75) return 'bg-warning';
    return 'bg-accent';
  };

  const getStatusBgColor = () => {
    if (status === 'exceeded' || percentage >= 100) return 'bg-negative/10';
    if (status === 'warning' || percentage >= 75) return 'bg-warning/10';
    return 'bg-surface-hover';
  };

  return (
    <div className="py-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-text-primary">{category}</span>
        <span className="text-sm text-text-secondary">
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </span>
      </div>
      <div className={`h-2 rounded-full ${getStatusBgColor()}`}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(percentage, 100)}%` }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 15, delay: 0.2 }}
          className={`h-full rounded-full ${getStatusColor()}`}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-text-muted">{percentage.toFixed(0)}% used</span>
        {percentage >= 100 && (
          <span className="text-xs text-negative font-medium">Over budget</span>
        )}
      </div>
    </div>
  );
}
