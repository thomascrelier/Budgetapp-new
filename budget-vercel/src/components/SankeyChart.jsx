'use client';

import { useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

const NODE_COLORS = {
  'Rental Income': '#22C55E',
  'Net Surplus': '#3B82F6',
};
const DEFAULT_NODE_COLOR = '#737373';
const LINK_OPACITY = 0.25;
const LINK_HOVER_OPACITY = 0.5;

export default function SankeyChart({ data, width = 800, height = 400 }) {
  const [hoveredLink, setHoveredLink] = useState(null);

  const { nodes, links } = useMemo(() => {
    if (!data || !data.nodes.length || !data.links.length) return { nodes: [], links: [] };

    const sankeyLayout = sankey()
      .nodeWidth(20)
      .nodePadding(16)
      .nodeAlign(sankeyJustify)
      .extent([[1, 1], [width - 1, height - 1]]);

    const graph = sankeyLayout({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    return graph;
  }, [data, width, height]);

  if (!nodes.length) return null;

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const getNodeColor = (node) => NODE_COLORS[node.name] || DEFAULT_NODE_COLOR;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="mx-auto">
        {/* Links */}
        <g>
          {links.map((link, i) => {
            const isHovered = hoveredLink === i;
            return (
              <g key={i}>
                <path
                  d={sankeyLinkHorizontal()(link)}
                  fill="none"
                  stroke={getNodeColor(link.source)}
                  strokeWidth={Math.max(1, link.width)}
                  strokeOpacity={isHovered ? LINK_HOVER_OPACITY : LINK_OPACITY}
                  onMouseEnter={() => setHoveredLink(i)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="transition-opacity duration-150"
                />
                {isHovered && (
                  <title>
                    {link.source.name} → {link.target.name}: {formatCurrency(link.value)}
                  </title>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node, i) => (
            <g key={i}>
              <rect
                x={node.x0}
                y={node.y0}
                width={node.x1 - node.x0}
                height={Math.max(1, node.y1 - node.y0)}
                fill={getNodeColor(node)}
                rx={2}
              >
                <title>{node.name}: {formatCurrency(node.value)}</title>
              </rect>
              <text
                x={node.x0 < width / 2 ? node.x1 + 8 : node.x0 - 8}
                y={(node.y0 + node.y1) / 2}
                textAnchor={node.x0 < width / 2 ? 'start' : 'end'}
                dominantBaseline="central"
                className="text-xs fill-current text-text-secondary"
                style={{ fontSize: '12px', fill: '#525252' }}
              >
                {node.name} ({formatCurrency(node.value)})
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
