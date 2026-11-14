import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getBudgets, getSettings } from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { budgetStatus } from '@/lib/analytics';
import { currentMonth } from '@/lib/dates';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();

    const [accounts, allTransactions, budgets, settings] = await Promise.all([
      getAccounts(),
      getAllTransactions(),
      getBudgets(),
      getSettings(),
    ]);
    const accountIds = resolveAccountIds(searchParams, accounts, settings);
    const transactions = allTransactions.filter(t => accountIds.includes(t.account_id));

    return NextResponse.json({
      budgets: budgetStatus(budgets, transactions, month),
      month,
    });
  } catch (error) {
    console.error('Error fetching budget status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
