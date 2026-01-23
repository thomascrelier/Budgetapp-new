export default function BudgetProgressBar({ category, spent, limit, percentage, status }) {
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getBarColor = () => {
    if (status === 'red' || percentage >= 100) return 'bg-red-500';
    if (status === 'yellow' || percentage >= 75) return 'bg-amber-500';
    return 'bg-tiffany';
  };

  const getTextColor = () => {
    if (status === 'red' || percentage >= 100) return 'text-red-600';
    if (status === 'yellow' || percentage >= 75) return 'text-amber-600';
    return 'text-tiffany-dark';
  };

  const cappedPercentage = Math.min(percentage, 100);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium text-charcoal">{category}</span>
        <span className={`text-sm font-medium ${getTextColor()}`}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${cappedPercentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-gray-500">
          {percentage.toFixed(0)}% used
        </span>
        {percentage >= 100 && (
          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Over Budget
          </span>
        )}
      </div>
    </div>
  );
}
