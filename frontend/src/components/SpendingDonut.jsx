import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
  '#818CF8', '#A78BFA', '#67E8F9', '#7DD3FC', '#5EEAD4',
  '#FCD34D', '#F9A8D4', '#BEF264', '#FDBA74', '#94A3B8',
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const { category, amount, percentage } = payload[0].payload;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
      <p className="font-semibold text-gray-900">{category}</p>
      <p className="text-gray-700">{currencyFormatter.format(amount)}</p>
      <p className="text-gray-500 text-sm">{percentage}%</p>
    </div>
  );
}

function CenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-gray-900 font-bold text-xl"
    >
      {currencyFormatter.format(total)}
    </text>
  );
}

export default function SpendingDonut({ categories, total }) {
  const hasData = categories && categories.length > 0 && total > 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Spending by Category
      </h2>

      {!hasData ? (
        <div className="flex items-center justify-center h-[250px] text-gray-500">
          No spending data this month
        </div>
      ) : (
        <>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {categories.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                  <CenterLabel total={total} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
            {categories.map((entry, index) => (
              <div key={entry.category} className="flex items-center gap-2">
                <div
                  className="w-[10px] h-[10px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-700">
                  {entry.category}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {currencyFormatter.format(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
