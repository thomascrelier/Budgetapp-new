import { NextResponse } from 'next/server';
import { getAllTransactions, getAccounts } from '@/lib/sheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 30;
    const accountId = searchParams.get('account_id');
    const accountIdsParam = searchParams.get('account_ids');

    const [transactions, accounts] = await Promise.all([
      getAllTransactions(),
      getAccounts(),
    ]);

    // Filter by account(s) if specified
    let filteredTransactions = transactions;
    let filteredAccounts = accounts;

    if (accountId) {
      const id = parseInt(accountId);
      filteredTransactions = transactions.filter(t => t.account_id === id);
      filteredAccounts = accounts.filter(a => a.id === id);
    } else if (accountIdsParam) {
      const ids = accountIdsParam.split(',').map(Number);
      filteredTransactions = transactions.filter(t => ids.includes(t.account_id));
      filteredAccounts = accounts.filter(a => ids.includes(a.id));
    }

    // Calculate initial balance from filtered accounts
    const initialBalance = filteredAccounts.reduce((sum, a) => sum + a.initial_balance, 0);

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Sort transactions by date ascending
    const sortedTransactions = filteredTransactions
      .filter(t => t.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate running balance up to start date
    let runningBalance = initialBalance;
    for (const t of sortedTransactions) {
      if (t.date < startDate.toISOString().split('T')[0]) {
        runningBalance += t.amount;
      }
    }

    // Build daily balance data
    const data = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Add all transactions for this date
      const dayTransactions = sortedTransactions.filter(t => t.date === dateStr);
      for (const t of dayTransactions) {
        runningBalance += t.amount;
      }

      data.push({
        date: dateStr,
        balance: runningBalance,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching balance history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
