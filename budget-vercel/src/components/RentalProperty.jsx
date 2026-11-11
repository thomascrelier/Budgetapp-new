'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '@/lib/api';
import { useChartTheme } from './ThemeProvider';
import PageTransition from './PageTransition';

// One authored moment: the three annual figures settle in sequence. Everything else arrives with the page.
const summaryVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const summaryItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const FIRST_YEAR = 2024;

const currency0 = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const currency2 = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (value) => currency0.format(value || 0);
const formatCurrencyDecimal = (value) => currency2.format(value || 0);
const formatSigned = (value, fmt = formatCurrency) => `${value > 0 ? '+' : ''}${fmt(value)}`;
const formatAxis = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `$${(v / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `$${v}`;
};

const formatDelta = (dollars, percent) => {
  if (percent === null || percent === undefined) return 'New';
  const sign = dollars >= 0 ? '+' : '';
  return `${sign}${formatCurrency(dollars)} (${sign}${percent.toFixed(1)}%)`;
};

const thClass = 'px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap';

export default function RentalProperty() {
  const { gridColor, tickColor, tooltipStyle, positiveColor, negativeColor, accentColor, pieColors } = useChartTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedGroups, setExpandedGroups] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getRentalProperty(year);
      if (!result || result.error) throw new Error(result?.error || 'Empty response');
      setData(result);
    } catch (err) {
      console.error('Failed to load rental property data:', err);
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const yearOptions = [];
  for (let y = Math.max(new Date().getFullYear(), 2026); y >= FIRST_YEAR; y--) yearOptions.push(y);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Rental Property</h1>
        <p className="text-text-tertiary mt-1">Analytics & tax summary for your rental property</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-tertiary">
        <span>Tax year</span>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="min-h-11 px-4 py-2 border border-border rounded-lg bg-surface text-text-primary tabular focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
      </label>
    </div>
  );

  // First load: a skeleton in the page's real shape, not a bare spinner.
  if (loading && !data) {
    return (
      <div className="space-y-8" aria-busy="true">
        {header}
        <span role="status" className="sr-only">Loading rental property data for {year}</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 md:p-6">
              <div className="h-4 w-24 rounded bg-surface-hover animate-pulse" />
              <div className="h-8 w-36 rounded bg-surface-hover animate-pulse mt-2" />
              <div className="h-3 w-44 rounded bg-surface-hover animate-pulse mt-3" />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl h-72 animate-pulse" aria-hidden="true" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-8">
        {header}
        <div role="alert" className="glass-card rounded-xl p-8 md:p-12 text-center">
          <p className="text-text-primary font-medium">Couldn&rsquo;t load rental property data for {year}.</p>
          <p className="text-text-tertiary text-sm mt-1">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-6 min-h-11 px-5 rounded-lg bg-accent text-on-accent font-medium hover:bg-accent-hover transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const {
    prev_year = year - 1,
    annual_summary = {},
    prev_annual_summary = {},
    t776_summary = [],
    monthly_data = [],
    prev_monthly_data = [],
    category_breakdown = [],
    t776_pie_data = [],
    utility_tracker = [],
  } = data || {};

  const mergedMonthlyData = monthly_data.map((m, i) => ({
    month_name: m.month_name,
    income: m.income,
    expenses: m.expenses,
    prev_income: prev_monthly_data[i]?.income || 0,
    prev_expenses: prev_monthly_data[i]?.expenses || 0,
  }));

  const yoyCategoryData = category_breakdown
    .filter(c => !c.is_income)
    .map(c => ({ category: c.category, [String(year)]: c.selected_year_total, [String(prev_year)]: c.prev_year_total }));

  const pieTotal = t776_pie_data.reduce((s, d) => s + (d.value || 0), 0);

  const incomeDeltaColor = (dollars) => dollars >= 0 ? 'text-positive' : 'text-negative';
  const expenseDeltaColor = (dollars) => dollars <= 0 ? 'text-positive' : 'text-negative';
  const groupDeltaColor = (group) => group.is_income ? incomeDeltaColor(group.delta_dollars) : expenseDeltaColor(group.delta_dollars);

  const income = annual_summary.total_income || 0;
  const expenses = annual_summary.total_expenses || 0;
  const net = annual_summary.net_income || 0;
  const prevIncome = prev_annual_summary.total_income || 0;
  const prevExpenses = prev_annual_summary.total_expenses || 0;
  const prevNet = prev_annual_summary.net_income || 0;

  const summaryCards = [
    {
      label: 'Annual Income',
      value: formatCurrency(income),
      tone: 'text-positive',
      prev: prevIncome,
      showDelta: prevIncome > 0,
      delta: formatDelta(income - prevIncome, prevIncome ? ((income - prevIncome) / prevIncome) * 100 : null),
      deltaTone: incomeDeltaColor(income - prevIncome),
    },
    {
      label: 'Annual Expenses',
      value: formatCurrency(expenses),
      tone: 'text-negative',
      prev: prevExpenses,
      showDelta: prevExpenses > 0,
      delta: formatDelta(expenses - prevExpenses, prevExpenses ? ((expenses - prevExpenses) / prevExpenses) * 100 : null),
      deltaTone: expenseDeltaColor(expenses - prevExpenses),
    },
    {
      label: 'Net Income',
      value: formatSigned(net),
      tone: net >= 0 ? 'text-positive' : 'text-negative',
      prev: prevNet,
      showDelta: prev_annual_summary.net_income !== undefined && prevNet !== 0,
      delta: formatDelta(net - prevNet, prevNet ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null),
      deltaTone: incomeDeltaColor(net - prevNet),
    },
  ];

  const monthlyChartLabel = `Bar chart of monthly rental income and expenses for ${year}, with ${prev_year} shown as dashed lines. ${year} totals: income ${formatCurrency(income)}, expenses ${formatCurrency(expenses)}.`;
  const yoyChartLabel = `Horizontal bar chart comparing expense categories in ${year} and ${prev_year}. Exact figures are in the Category Details table below.`;

  return (
    <PageTransition>
      <div className={`space-y-8 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
        {header}
        {loading && <span role="status" className="sr-only">Loading {year}</span>}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-negative/30 bg-negative/5 px-4 py-3 text-sm">
            <span className="text-text-primary">Couldn&rsquo;t refresh {year}: {error}. Showing the last loaded year.</span>
            <button type="button" onClick={loadData} className="min-h-11 px-3 font-medium text-accent-text hover:underline underline-offset-4">Try again</button>
          </div>
        )}

        {/* Annual Summary */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={summaryVariants}
          initial="hidden"
          animate="visible"
        >
          {summaryCards.map((card) => (
            <motion.div key={card.label} variants={summaryItemVariants} className="glass-card rounded-xl p-4 md:p-6">
              <p className="text-text-tertiary text-sm">{card.label}</p>
              <p className={`text-2xl font-display tabular mt-1 ${card.tone}`}>{card.value}</p>
              <p className="text-xs text-text-muted mt-2 tabular">
                vs {formatCurrency(card.prev)} in {prev_year}
                {card.showDelta && (
                  <span className={`ml-1 ${card.deltaTone}`}>{card.delta}</span>
                )}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* T776 Tax Summary */}
        {t776_summary.length > 0 && (
          <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="t776-heading">
            <div className="px-4 md:px-6 py-4 border-b border-border/50">
              <h2 id="t776-heading" className="text-lg font-semibold text-text-primary">T776 Rental Income Tax Summary</h2>
              <p className="text-text-muted text-sm mt-1">CRA rental income form line groupings — select a line to see its categories</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full tabular">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${thClass} text-left`}>T776 Line</th>
                    <th scope="col" className={`${thClass} text-right`}>{year}</th>
                    <th scope="col" className={`${thClass} text-right`}>{prev_year}</th>
                    <th scope="col" className={`${thClass} text-right`}>Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {t776_summary.map((group) => {
                    const expanded = !!expandedGroups[group.group_name];
                    return (
                      <React.Fragment key={group.group_name}>
                        <tr className="hover:bg-surface-hover/50 transition-colors cursor-pointer" onClick={() => toggleGroup(group.group_name)}>
                          <th scope="row" className="px-4 md:px-6 py-2 text-left whitespace-nowrap font-normal">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={(e) => { e.stopPropagation(); toggleGroup(group.group_name); }}
                              className="flex items-center gap-2 min-h-11 text-left"
                            >
                              <svg aria-hidden="true" className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-semibold text-text-primary">{group.group_name}</span>
                            </button>
                          </th>
                          <td className="px-4 md:px-6 py-2 text-right whitespace-nowrap font-display text-text-primary">{formatCurrency(group.selected_year_total)}</td>
                          <td className="px-4 md:px-6 py-2 text-right whitespace-nowrap text-text-secondary">{formatCurrency(group.prev_year_total)}</td>
                          <td className={`px-4 md:px-6 py-2 text-right whitespace-nowrap text-sm ${groupDeltaColor(group)}`}>{formatDelta(group.delta_dollars, group.delta_percent)}</td>
                        </tr>
                        {expanded && group.children.map((child) => (
                          <tr key={child.category} className="bg-surface-hover/30">
                            <th scope="row" className="px-4 md:px-6 py-3 pl-12 md:pl-14 text-left whitespace-nowrap text-text-tertiary text-sm font-normal">{child.category}</th>
                            <td className="px-4 md:px-6 py-3 text-right whitespace-nowrap text-text-tertiary text-sm">{formatCurrency(child.selected_year_total)}</td>
                            <td className="px-4 md:px-6 py-3 text-right whitespace-nowrap text-text-muted text-sm">{formatCurrency(child.prev_year_total)}</td>
                            <td className={`px-4 md:px-6 py-3 text-right whitespace-nowrap text-xs ${groupDeltaColor(group)}`}>{formatDelta(child.delta_dollars, child.delta_percent)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr className="border-t-2 border-accent/40 bg-surface">
                    <th scope="row" className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-bold text-text-primary">Net Rental Income</th>
                    <td className={`px-4 md:px-6 py-4 text-right whitespace-nowrap font-display font-bold ${net >= 0 ? 'text-positive' : 'text-negative'}`}>{formatSigned(net)}</td>
                    <td className={`px-4 md:px-6 py-4 text-right whitespace-nowrap font-bold ${prevNet >= 0 ? 'text-positive' : 'text-negative'}`}>{formatSigned(prevNet)}</td>
                    <td className={`px-4 md:px-6 py-4 text-right whitespace-nowrap font-bold ${incomeDeltaColor(net - prevNet)}`}>
                      {formatDelta(net - prevNet, prevNet ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Utility Tracker */}
        {utility_tracker.length > 0 && (
          <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="utility-heading">
            <div className="px-4 md:px-6 py-4 border-b border-border/50">
              <h2 id="utility-heading" className="text-lg font-semibold text-text-primary">Tenant Utility Recovery</h2>
              <p className="text-text-muted text-sm mt-1">Elec & gas recovered same month; water (quarterly) recovered following month</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full tabular [&_td]:px-3 [&_th]:px-3 [&_th]:tracking-wide">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${thClass} text-left sticky left-0 z-10 bg-surface`}>Month</th>
                    <th scope="col" className={`${thClass} text-right`}>Electricity</th>
                    <th scope="col" className={`${thClass} text-right`}>Gas</th>
                    <th scope="col" className={`${thClass} text-right`}>Water</th>
                    <th scope="col" className={`${thClass} text-right`}>Total Bills</th>
                    <th scope="col" className={`${thClass} text-right`}>Brandon (40%)</th>
                    <th scope="col" className={`${thClass} text-right`}>Madison (60%)</th>
                    <th scope="col" className={`${thClass} text-right`}>Collected</th>
                    <th scope="col" className={`${thClass} text-right`}>Delta</th>
                    <th scope="col" className={`${thClass} text-right`}>Running Bal.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {utility_tracker.map((row) => {
                    const deltaColor = row.pending ? 'text-warning' : row.delta < -2 ? 'text-negative' : row.delta > 2 ? 'text-positive' : 'text-text-secondary';
                    const balColor = row.running_balance < -2 ? 'text-negative' : row.running_balance > 2 ? 'text-positive' : 'text-text-secondary';
                    const cell = 'px-4 py-3 text-right whitespace-nowrap text-sm';
                    return (
                      <tr key={row.month} className="hover:bg-surface-hover/50 transition-colors">
                        <th scope="row" className="px-4 py-3 text-left whitespace-nowrap font-medium text-text-primary sticky left-0 z-10 bg-surface">
                          {row.month_label}
                          {row.pending && (<span className="ml-2 text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">Pending</span>)}
                        </th>
                        <td className={`${cell} text-text-secondary`}>{row.electricity > 0 ? formatCurrencyDecimal(row.electricity) : '—'}</td>
                        <td className={`${cell} text-text-secondary`}>{row.gas > 0 ? formatCurrencyDecimal(row.gas) : '—'}</td>
                        <td className={`${cell} text-text-secondary`}>{row.water > 0 ? formatCurrencyDecimal(row.water) : '—'}</td>
                        <td className={`${cell} font-medium text-text-primary`}>{formatCurrencyDecimal(row.total_billed)}</td>
                        <td className={`${cell} text-text-secondary`}>{row.pending ? '—' : formatCurrencyDecimal(row.brandon_contribution)}</td>
                        <td className={`${cell} text-text-secondary`}>{row.pending ? '—' : formatCurrencyDecimal(row.madison_contribution)}</td>
                        <td className={`${cell} font-medium text-text-primary`}>{row.pending ? '—' : formatCurrencyDecimal(row.total_collected)}</td>
                        <td className={`${cell} font-semibold ${deltaColor}`}>
                          {row.pending ? 'Pending' : formatSigned(row.delta, formatCurrencyDecimal)}
                        </td>
                        <td className={`${cell} font-semibold ${balColor}`}>
                          {row.pending ? '—' : formatSigned(row.running_balance, formatCurrencyDecimal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="glass-card rounded-xl p-4 md:p-6 min-w-0" aria-labelledby="monthly-heading">
            <h2 id="monthly-heading" className="text-lg font-semibold text-text-primary mb-4">Monthly Income vs Expenses</h2>
            {mergedMonthlyData.length > 0 ? (
              <div className="h-64" role="img" aria-label={monthlyChartLabel}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mergedMonthlyData} margin={{ top: 10, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="month_name" tick={{ fill: tickColor, fontSize: 12 }} />
                    <YAxis tickFormatter={formatAxis} tick={{ fill: tickColor, fontSize: 12 }} width={52} />
                    <Tooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: tickColor }} />
                    <Bar dataKey="income" name={`${year} Income`} fill={positiveColor} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={`${year} Expenses`} fill={negativeColor} radius={[4, 4, 0, 0]} />
                    <Line dataKey="prev_income" name={`${prev_year} Income`} stroke={positiveColor} strokeDasharray="5 5" dot={false} strokeWidth={2} />
                    <Line dataKey="prev_expenses" name={`${prev_year} Expenses`} stroke={negativeColor} strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-tertiary">No monthly data for {year}</div>
            )}
          </section>

          <section className="glass-card rounded-xl p-4 md:p-6 min-w-0" aria-labelledby="breakdown-heading">
            <h2 id="breakdown-heading" className="text-lg font-semibold text-text-primary mb-4">Expense Breakdown</h2>
            {t776_pie_data.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-center">
                <div className="h-48 md:h-56" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={t776_pie_data} cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" paddingAngle={1} dataKey="value" nameKey="name" stroke="none">
                        {t776_pie_data.map((entry, index) => (<Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* The legend doubles as the chart's text alternative: name, amount, share. */}
                <ul className="space-y-2 text-sm tabular">
                  {t776_pie_data.map((entry, index) => (
                    <li key={entry.name} className="flex items-center gap-2">
                      <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                      <span className="text-text-secondary truncate min-w-0 flex-1">{entry.name}</span>
                      <span className="text-text-primary whitespace-nowrap">{formatCurrency(entry.value)}</span>
                      <span className="text-text-muted w-10 text-right">{pieTotal ? Math.round((entry.value / pieTotal) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="h-48 md:h-64 flex items-center justify-center text-text-tertiary">No expense data for this year</div>
            )}
          </section>
        </div>

        {/* YoY Comparison */}
        {yoyCategoryData.length > 0 && (
          <section className="glass-card rounded-xl p-4 md:p-6" aria-labelledby="yoy-heading">
            <h2 id="yoy-heading" className="text-lg font-semibold text-text-primary mb-4">Year-over-Year Category Comparison</h2>
            <div style={{ height: Math.max(300, yoyCategoryData.length * 50) }} role="img" aria-label={yoyChartLabel}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yoyCategoryData} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tickFormatter={formatAxis} tick={{ fill: tickColor, fontSize: 12 }} />
                  <YAxis dataKey="category" type="category" tick={{ fill: tickColor, fontSize: 12 }} width={120} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: tickColor }} />
                  <Bar dataKey={String(year)} name={String(year)} fill={accentColor} radius={[0, 4, 4, 0]} />
                  <Bar dataKey={String(prev_year)} name={String(prev_year)} fill={tickColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Category Details Table */}
        <section className="glass-card rounded-xl overflow-hidden" aria-labelledby="category-heading">
          <div className="px-4 md:px-6 py-4 border-b border-border/50">
            <h2 id="category-heading" className="text-lg font-semibold text-text-primary">Category Details</h2>
          </div>
          {category_breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full tabular">
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${thClass} text-left`}>Category</th>
                    <th scope="col" className={`${thClass} text-right`}>{year} Total</th>
                    <th scope="col" className={`${thClass} text-right`}>{prev_year} Total</th>
                    <th scope="col" className={`${thClass} text-right`}>Change</th>
                    <th scope="col" className={`${thClass} text-right`}>Monthly Avg</th>
                    <th scope="col" className={`${thClass} text-right`}>Txns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {category_breakdown.map((item, index) => (
                    <tr key={item.category} className="hover:bg-surface-hover/50 transition-colors">
                      <th scope="row" className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-normal">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                          <span className="font-medium text-text-primary">{item.category}</span>
                          {item.is_income && (<span className="text-xs bg-positive/10 text-positive px-2 py-0.5 rounded-full">Income</span>)}
                        </div>
                      </th>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right font-display text-text-primary">{formatCurrency(item.selected_year_total)}</td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-text-secondary">{formatCurrency(item.prev_year_total)}</td>
                      <td className={`px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm ${item.is_income ? incomeDeltaColor(item.delta_dollars) : expenseDeltaColor(item.delta_dollars)}`}>{formatDelta(item.delta_dollars, item.delta_percent)}</td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-text-secondary">{formatCurrency(item.monthly_avg)}</td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-text-secondary">{item.transaction_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-text-tertiary">No data available for {year}</div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
