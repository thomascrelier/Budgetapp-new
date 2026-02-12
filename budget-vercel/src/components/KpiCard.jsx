'use client';

export default function KpiCard({ title, value, type = 'default', subtitle, icon }) {
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getValueColor = () => {
    switch (type) {
      case 'income':
        return 'text-positive';
      case 'expense':
        return 'text-negative';
      case 'dynamic':
        return value >= 0 ? 'text-positive' : 'text-negative';
      default:
        return 'text-text-primary';
    }
  };

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-tertiary text-sm font-medium">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${getValueColor()}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && (
            <p className="text-text-muted text-xs mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-background rounded-full">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
