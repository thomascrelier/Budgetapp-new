export default function KpiCard({ title, value, subtitle, type = 'default', icon }) {
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getValueColor = () => {
    if (type === 'expense') return 'text-rose-400';
    if (type === 'income') return 'text-emerald-500';
    if (type === 'dynamic') {
      const num = parseFloat(value) || 0;
      return num >= 0 ? 'text-emerald-500' : 'text-rose-400';
    }
    return 'text-tiffany';
  };

  const getBorderColor = () => {
    if (type === 'expense') return 'border-l-rose-400';
    if (type === 'income') return 'border-l-emerald-400';
    if (type === 'dynamic') {
      const num = parseFloat(value) || 0;
      return num >= 0 ? 'border-l-emerald-400' : 'border-l-rose-400';
    }
    return 'border-l-tiffany';
  };

  return (
    <div className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${getBorderColor()} card-hover`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">
            {title}
          </p>
          <p className={`text-3xl font-bold mt-2 ${getValueColor()}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && (
            <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-tiffany-light rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
