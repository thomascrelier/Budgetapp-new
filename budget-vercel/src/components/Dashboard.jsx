'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useReducedMotion } from 'framer-motion';
import api from '@/lib/api';
import KpiCard from './KpiCard';
import SpendingRiskTracker from './SpendingRiskTracker';
import MonthDetail from './MonthDetail';
import { useChartTheme } from './ThemeProvider';
import PageTransition from './PageTransition';
import { formatMoney, formatMoneyCompact } from './AnimatedNumber';

const ACCOUNT_NAMES = ['Main Chequing', 'CIBC Visa', 'Rogers Mastercard'];

// 'YYYY-MM' and 'YYYY-MM-DD' are calendar dates, not instants. `new Date('2026-11-03')` parses as UTC
// midnight and renders as Nov 2 in North American time zones, so build local dates from the parts.
const parseMonth = (monthStr) => {
  const [y, m] = String(monthStr).split('-').map(Number);
  return new Date(y, m - 1, 1);
};
const parseDay = (dateStr) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const monthShort = (s) => parseMonth(s).toLocaleDateString('en-CA', { month: 'short' });
const monthLong = (s) => parseMonth(s).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
const dayShort = (s) => parseDay(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const dayLong = (s) => parseDay(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

function SectionHeader({ id, title, children }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-lg font-semibold text-text-primary">{title}</h2>
      {children && <p className="mt-0.5 text-sm text-text-tertiary">{children}</p>}
    </div>
  );
}

function EmptyChart({ children }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-text-tertiary">
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  const block = 'rounded bg-surface-hover';
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">Loading dashboard</span>
      <div aria-hidden="true" className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className={`${block} h-8 w-40`} />
          <div className={`${block} h-4 w-64`} />
        </div>
        {[0, 1].map((strip) => (
          <div key={strip} className="glass-card grid grid-cols-1 divide-y divide-border rounded-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[0, 1, 2].map((cell) => (
              <div key={cell} className="space-y-2 px-6 py-5">
                <div className={`${block} h-4 w-28`} />
                <div className={`${block} h-8 w-32`} />
              </div>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[0, 1].map((card) => (
            <div key={card} className="glass-card space-y-4 rounded-xl p-6">
              <div className={`${block} h-5 w-32`} />
              <div className={`${block} h-64`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    gridColor,
    tickColor,
    tooltipStyle,
    positiveColor,
    negativeColor,
    accentTextColor,
  } = useChartTheme();
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [personalAccountIds, setPersonalAccountIds] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const accountsRes = await api.getAccounts();
      const allAccounts = accountsRes.accounts || [];
      setAccounts(allAccounts);

      const personalIds = allAccounts
        .filter(a => a.name !== 'CIBC Rental')
        .map(a => a.id)
        .join(',');
      setPersonalAccountIds(personalIds || null);

      let accountIds = personalIds || null;

      const [dashboardRes, cashFlowRes, balanceRes] = await Promise.all([
        api.getDashboard(accountIds),
        api.getCashFlow(6, accountIds),
        api.getBalanceHistory(30, accountIds),
      ]);

      setDashboard(dashboardRes);
      setCashFlow(cashFlowRes.data || []);
      setBalanceHistory(balanceRes.data || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (loadError) {
    return (
      <div role="alert" className="glass-card mx-auto mt-8 max-w-md rounded-xl p-8 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Couldn&rsquo;t load your dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Check your connection, then try again.</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-5 min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  if (selectedMonth) {
    return (
      <MonthDetail
        month={selectedMonth}
        selectedAccount={null}
        onBack={() => setSelectedMonth(null)}
      />
    );
  }

  const kpis = dashboard?.kpis || {};

  const handleBarClick = (data) => {
    if (data?.month) {
      setSelectedMonth(data.month);
    }
  };

  // Text alternatives for the charts
  const cashFlowSummary = cashFlow.length
    ? `Income and expenses by month, ${monthLong(cashFlow[0].month)} to ${monthLong(cashFlow[cashFlow.length - 1].month)}. ` +
      cashFlow
        .map(m => `${monthLong(m.month)}: income ${formatMoney(m.income)}, expenses ${formatMoney(m.expenses)}`)
        .join('; ') + '.'
    : '';

  const firstBalance = balanceHistory[0];
  const lastBalance = balanceHistory[balanceHistory.length - 1];
  const balanceChange = firstBalance && lastBalance ? lastBalance.balance - firstBalance.balance : null;
  const balanceSummary = firstBalance && lastBalance
    ? `Balance went from ${formatMoney(firstBalance.balance)} on ${dayLong(firstBalance.date)} to ${formatMoney(lastBalance.balance)} on ${dayLong(lastBalance.date)}.`
    : '';

  const axisTick = { fill: tickColor, fontSize: 12 };
  const tooltipLabelStyle = { color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 };

  return (
    <PageTransition>
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-text-tertiary">Overview of your financial health</p>
      </div>

      {/* This month: one surface, three figures */}
      <section aria-label="This month" className="glass-card grid grid-cols-1 divide-y divide-border rounded-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <KpiCard title="Total Balance" value={kpis.total_balance} />
        <KpiCard title="Month-to-Date Spending" value={kpis.monthly_spending} />
        <KpiCard title="Net Cash Flow" value={kpis.net_cash_flow} signed subtitle="This month" />
      </section>

      {/* Account balances */}
      <section aria-labelledby="accounts-title" className="glass-card rounded-xl">
        <h2 id="accounts-title" className="px-5 pt-4 text-sm font-medium text-text-secondary sm:px-6">Accounts</h2>
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {ACCOUNT_NAMES.map((accountName) => {
            const account = accounts.find(a => a.name === accountName);
            const balance = account ? parseFloat(account.current_balance) : null;
            const isCredit = ['visa', 'credit', 'mastercard'].some(k => accountName.toLowerCase().includes(k));

            let tone = 'neutral';
            let annotation;
            let shown = balance;
            if (balance !== null && isCredit) {
              shown = Math.abs(balance);
              if (balance > 0) { tone = 'negative'; annotation = 'owed'; }
              else if (balance < 0) { tone = 'positive'; annotation = 'credit'; }
            } else if (balance !== null && balance < 0) {
              tone = 'negative';
              annotation = 'overdrawn';
            }

            return (
              <KpiCard
                key={accountName}
                title={accountName}
                value={shown}
                tone={tone}
                annotation={annotation}
                size="sm"
                subtitle={!account ? 'Account not found' : undefined}
                className="pt-2 sm:pt-2"
              />
            );
          })}
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cash Flow */}
        <section aria-labelledby="cash-flow-title" className="glass-card min-w-0 rounded-xl p-6">
          <SectionHeader id="cash-flow-title" title="Cash Flow">
            Last {cashFlow.length || 6} months. Select a month for its details.
          </SectionHeader>
          {cashFlow.length === 0 ? (
            <EmptyChart>No income or expenses in the last 6 months yet. Upload a statement to see cash flow.</EmptyChart>
          ) : (
            <>
              <div className="h-64" role="img" aria-label={cashFlowSummary}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlow} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthShort} tick={axisTick} stroke={gridColor} tickLine={false} />
                    <YAxis tickFormatter={formatMoneyCompact} tick={axisTick} width={56} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => formatMoney(value)}
                      labelFormatter={monthLong}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      cursor={{ fill: gridColor, fillOpacity: 0.5 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(label) => <span style={{ color: tickColor }}>{label}</span>}
                    />
                    <Bar dataKey="income" name="Income" fill={positiveColor} radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} isAnimationActive={!reduceMotion} />
                    <Bar dataKey="expenses" name="Expenses" fill={negativeColor} radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} isAnimationActive={!reduceMotion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Keyboard and touch path into a month; also the readable net per month */}
              <ul className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label="Open a month">
                {cashFlow.map((m) => {
                  const net = m.net ?? (m.income - m.expenses);
                  return (
                    <li key={m.month}>
                      <button
                        type="button"
                        onClick={() => setSelectedMonth(m.month)}
                        aria-label={`${monthLong(m.month)}: net ${formatMoney(net, { signed: true })}. Open details`}
                        className="flex min-h-11 w-full flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-hover"
                      >
                        <span className="text-xs font-medium text-text-secondary">{monthShort(m.month)}</span>
                        <span className={`tabular text-xs ${net > 0 ? 'text-positive' : net < 0 ? 'text-negative' : 'text-text-muted'}`}>
                          {formatMoneyCompact(net).replace(/^\$/, net > 0 ? '+$' : '$')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <SpendingRiskTracker />
      </div>

      {/* Balance History */}
      <section aria-labelledby="balance-title" className="glass-card min-w-0 rounded-xl p-6">
        <SectionHeader id="balance-title" title="Balance History">
          {lastBalance ? (
            <>
              Last 30 days.{' '}
              <span className="tabular text-text-secondary">{formatMoney(lastBalance.balance)}</span> today
              {balanceChange !== null && (
                <>
                  ,{' '}
                  <span className={`tabular font-medium ${balanceChange > 0 ? 'text-positive' : balanceChange < 0 ? 'text-negative' : 'text-text-secondary'}`}>
                    {formatMoney(balanceChange, { signed: true })}
                  </span>{' '}
                  since {dayShort(firstBalance.date)}
                </>
              )}
              .
            </>
          ) : (
            'Last 30 days'
          )}
        </SectionHeader>
        {balanceHistory.length === 0 ? (
          <EmptyChart>No balance history for the last 30 days yet.</EmptyChart>
        ) : (
          <div className="h-64" role="img" aria-label={balanceSummary}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceHistory} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayShort} tick={axisTick} interval="preserveStartEnd" minTickGap={24} stroke={gridColor} tickLine={false} />
                <YAxis tickFormatter={formatMoneyCompact} tick={axisTick} width={56} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(value) => formatMoney(value)}
                  labelFormatter={dayLong}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ stroke: tickColor, strokeDasharray: '3 3' }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Balance"
                  stroke={accentTextColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: accentTextColor, stroke: tooltipStyle.backgroundColor, strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Budget Alerts */}
      {dashboard?.budget_alerts?.length > 0 && (
        <section aria-labelledby="alerts-title" className="rounded-xl border border-negative/25 bg-negative/5 p-6">
          <h2 id="alerts-title" className="mb-3 flex items-center gap-2 text-lg font-semibold text-negative">
            <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Budget Alerts
          </h2>
          <ul className="divide-y divide-negative/15">
            {dashboard.budget_alerts.map((alert) => (
              <li key={alert.category_name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                <span className="font-medium text-text-primary">{alert.category_name}</span>
                <span className="tabular text-text-secondary">
                  {(() => {
                    const pct = Math.round(Number(alert.percentage_used) || 0);
                    // Over the limit reads as a problem; nearing it is a warning, not the same red.
                    return pct >= 100
                      ? <span className="font-semibold text-negative">{pct}% used, over</span>
                      : <span className="font-semibold text-warning">{pct}% used</span>;
                  })()}
                  {' '}({formatMoney(alert.spent)} of {formatMoney(alert.monthly_limit)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </PageTransition>
  );
}
