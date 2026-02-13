import { NextResponse } from 'next/server';
import { getAccountsWithBalances, getAllTransactions, getBudgets } from '@/lib/sheets';

// Categories that represent money movement, not actual spending
const NON_SPENDING_CATEGORIES = ['Transfer', 'Transfers & Payments', 'Investments'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get('account_ids');
    const accountIds = accountIdsParam ? accountIdsParam.split(',').map(Number) : null;

    // Get accounts and transactions
    const accounts = await getAccountsWithBalances();
    const allTransactions = await getAllTransactions();
    const budgets = await getBudgets();

    // Filter by account if specified
    const filteredAccounts = accountIds
      ? accounts.filter(a => accountIds.includes(a.id))
      : accounts;

    let transactions = allTransactions;
    if (accountIds) {
      transactions = transactions.filter(t => accountIds.includes(t.account_id));
    }

    // Calculate total balance
    const totalBalance = filteredAccounts.reduce((sum, a) => sum + a.current_balance, 0);

    // Calculate monthly spending and income
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));

    let monthlyIncome = 0;
    let monthlySpending = 0;
    for (const t of monthTransactions) {
      const isNonSpending = NON_SPENDING_CATEGORIES.includes(t.category);
      if (t.amount > 0) monthlyIncome += t.amount;
      else if (!isNonSpending) monthlySpending += Math.abs(t.amount);
    }

    // Calculate spending by category for budget alerts
    const spendingByCategory = {};
    for (const t of monthTransactions) {
      if (t.amount < 0 && !NON_SPENDING_CATEGORIES.includes(t.category)) {
        const cat = t.category || 'Uncategorized';
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount);
      }
    }

    // Check for budget alerts
    const budgetAlerts = budgets
      .map(budget => {
        const spent = spendingByCategory[budget.category_name] || 0;
        const percentageUsed = budget.monthly_limit > 0
          ? (spent / budget.monthly_limit) * 100
          : 0;

        if (percentageUsed >= budget.alert_threshold) {
          return {
            category_name: budget.category_name,
            spent,
            monthly_limit: budget.monthly_limit,
            percentage_used: percentageUsed,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.percentage_used - a.percentage_used);

    return NextResponse.json({
      kpis: {
        total_balance: totalBalance,
        monthly_spending: monthlySpending,
        monthly_income: monthlyIncome,
        net_cash_flow: monthlyIncome - monthlySpending,
      },
      budget_alerts: budgetAlerts,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
