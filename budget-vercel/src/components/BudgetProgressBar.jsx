'use client';

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
    return 'bg-text-primary';
  };

  const getStatusBgColor = () => {
    if (status === 'exceeded' || percentage >= 100) return 'bg-red-100';
    if (status === 'warning' || percentage >= 75) return 'bg-amber-100';
    return 'bg-neutral-100';
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
        <div
          className={`h-full rounded-full transition-all ${getStatusColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
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
