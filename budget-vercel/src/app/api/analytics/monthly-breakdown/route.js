import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { summarize, inMonth, round2 } from '@/lib/analytics';
import { classify } from '@/lib/classify';
import { currentMonth, todayISO } from '@/lib/dates';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month parameter is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    const [accounts, allTransactions, settings] = await Promise.all([
      getAccounts(),
      getAllTransactions(),
      getSettings(),
    ]);
    const accountIds = resolveAccountIds(searchParams, accounts, settings);
    const transactions = inMonth(allTransactions, month).filter(t => accountIds.includes(t.account_id));

    const { income, spending, byCategory } = summarize(transactions);
    const spendingTxns = transactions.filter(t => ['expense', 'refund'].includes(classify(t)));

    // total is signed like the sheet: negative means net spending
    const counts = {};
    for (const t of spendingTxns) {
      const c = t.category || 'Uncategorized';
      counts[c] = (counts[c] || 0) + 1;
    }
    const category_breakdown = Object.entries(byCategory)
      .map(([category, spent]) => ({ category, total: round2(-spent), count: counts[category] || 0 }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // Daily net spending, capped to today (Toronto) in the current month
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const lastDay = month === currentMonth() ? Number(todayISO().slice(8, 10)) : daysInMonth;

    const dailyMap = {};
    for (let d = 1; d <= lastDay; d++) {
      dailyMap[`${month}-${String(d).padStart(2, '0')}`] = 0;
    }
    for (const t of spendingTxns) {
      if (t.date in dailyMap) dailyMap[t.date] -= t.amount;
    }
    let cumulative = 0;
    const daily_spending = Object.keys(dailyMap).sort().map((date) => {
      const amount = round2(dailyMap[date]);
      cumulative = round2(cumulative + amount);
      return { date, amount, cumulative };
    });

    const top_transactions = transactions
      .filter(t => classify(t) === 'expense')
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 10)
      .map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
      }));

    return NextResponse.json({
      month,
      income,
      expenses: spending,
      net: round2(income - spending),
      category_breakdown,
      daily_spending,
      top_transactions,
    });
  } catch (error) {
    console.error('Error fetching monthly breakdown:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
