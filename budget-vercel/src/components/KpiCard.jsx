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
    <div className="glass-card rounded-xl p-6 hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-tertiary text-sm font-medium tracking-wide">{title}</p>
          <p className={`text-2xl font-display mt-1 ${getValueColor()}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && (
            <p className="text-text-muted text-xs mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-surface-hover/50 rounded-full">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
