import { useMemo } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';

const CATEGORY_COLORS = [
  '#818CF8',
  '#A78BFA',
  '#67E8F9',
  '#7DD3FC',
  '#5EEAD4',
  '#FCD34D',
  '#F9A8D4',
  '#BEF264',
  '#FDBA74',
  '#94A3B8',
];

const INCOME_COLOR = '#34D399';
const SAVINGS_COLOR = '#6EE7B7';
const DEFICIT_COLOR = '#FDA4AF';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function SankeyDiagram({ income, categories, month, className }) {
  const sankeyData = useMemo(() => {
    if (!categories || categories.length === 0) {
      return null;
    }

    const totalExpenses = categories.reduce((sum, cat) => sum + cat.amount, 0);
    const difference = income - totalExpenses;

    // Build the color map for node coloring
    const colorMap = {
      Income: INCOME_COLOR,
    };

    categories.forEach((cat, index) => {
      colorMap[cat.category] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    });

    // Build nodes
    const nodes = [
      { id: 'Income', nodeColor: INCOME_COLOR },
      ...categories.map((cat, index) => ({
        id: cat.category,
        nodeColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      })),
    ];

    // Build links
    const links = categories.map((cat) => ({
      source: 'Income',
      target: cat.category,
      value: cat.amount,
    }));

    // Add Savings or Deficit node
    if (difference > 0) {
      nodes.push({ id: 'Savings', nodeColor: SAVINGS_COLOR });
      colorMap['Savings'] = SAVINGS_COLOR;
      links.push({
        source: 'Income',
        target: 'Savings',
        value: difference,
      });
    } else if (difference < 0) {
      nodes.push({ id: 'Deficit', nodeColor: DEFICIT_COLOR });
      colorMap['Deficit'] = DEFICIT_COLOR;
      links.push({
        source: 'Income',
        target: 'Deficit',
        value: Math.abs(difference),
      });
    }

    return { nodes, links, colorMap };
  }, [income, categories]);

  if (!categories || categories.length === 0) {
    return (
      <div className={className || 'h-96'}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No expense data for this month</p>
        </div>
      </div>
    );
  }

  if (!sankeyData) {
    return null;
  }

  const { nodes, links, colorMap } = sankeyData;

  return (
    <div className={className || 'h-96'}>
      <ResponsiveSankey
        data={{ nodes, links }}
        margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
        align="justify"
        colors={(node) => colorMap[node.id] || '#64748B'}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={18}
        nodeSpacing={24}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={0.3}
        linkHoverOthersOpacity={0.1}
        linkContract={3}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
        label={(node) => `${node.id} ${formatCurrency(node.value)}`}
        nodeTooltip={({ node }) => (
          <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-200">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: node.color }}
              />
              <span className="font-semibold text-sm text-gray-800">
                {node.id}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {formatCurrency(node.value)}
              {income > 0 && (
                <span className="ml-1 text-gray-400">
                  ({((node.value / income) * 100).toFixed(1)}% of income)
                </span>
              )}
            </p>
          </div>
        )}
        linkTooltip={({ link }) => (
          <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-200">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: colorMap[link.target.id] || '#64748B' }}
              />
              <span className="font-semibold text-sm text-gray-800">
                {link.target.id}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {formatCurrency(link.value)}
              {income > 0 && (
                <span className="ml-1 text-gray-400">
                  ({((link.value / income) * 100).toFixed(1)}% of income)
                </span>
              )}
            </p>
          </div>
        )}
      />
    </div>
  );
}
