import { NextResponse } from 'next/server';
import {
  getAccountsWithBalances,
  getAllTransactions,
  getBudgets,
  getParseIssues,
  getSettings,
} from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { summarize, inMonth, budgetStatus } from '@/lib/analytics';
import { currentMonth } from '@/lib/dates';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const [accounts, allTransactions, budgets, settings, parseIssues] = await Promise.all([
      getAccountsWithBalances(),
      getAllTransactions(),
      getBudgets(),
      getSettings(),
      getParseIssues(),
    ]);

    const accountIds = resolveAccountIds(searchParams, accounts, settings);
    const transactions = allTransactions.filter(t => accountIds.includes(t.account_id));
    const scopedAccounts = accounts.filter(a => accountIds.includes(a.id));

    const totalBalance = scopedAccounts.reduce((sum, a) => sum + a.current_balance, 0);

    const month = currentMonth();
    const { income, spending, net } = summarize(inMonth(transactions, month));

    const budgetAlerts = budgetStatus(budgets, transactions, month)
      .filter(b => b.status !== 'on_track')
      .map(b => ({
        category_name: b.category_name,
        spent: b.spent,
        monthly_limit: b.monthly_limit,
        percentage_used: b.percentage_used,
      }))
      .sort((a, b) => b.percentage_used - a.percentage_used);

    return NextResponse.json({
      kpis: {
        total_balance: totalBalance,
        monthly_spending: spending,
        monthly_income: income,
        net_cash_flow: net,
      },
      budget_alerts: budgetAlerts,
      data_issues: {
        unreadable_rows: parseIssues.map(t => ({ row_number: t.row_number, reason: t.parse_error })),
        rows_without_id: allTransactions.filter(t => t.id === null).length,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
