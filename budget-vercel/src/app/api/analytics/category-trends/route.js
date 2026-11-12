import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { summarize, inMonth } from '@/lib/analytics';
import { lastNMonths } from '@/lib/dates';

const TRACKED_CATEGORIES = ['Coffee Shops', 'Car Fuel', 'Groceries', 'Dining'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const [accounts, allTransactions, settings] = await Promise.all([
      getAccounts(),
      getAllTransactions(),
      getSettings(),
    ]);
    const accountIds = resolveAccountIds(searchParams, accounts, settings);
    const transactions = allTransactions.filter(t => accountIds.includes(t.account_id));

    const months = lastNMonths(3); // current + 2 prior
    const byMonth = Object.fromEntries(
      months.map(m => [m, summarize(inMonth(transactions, m)).byCategory])
    );

    const categories = TRACKED_CATEGORIES.map(category => {
      const monthlyData = months.map(month => ({
        month,
        amount: Math.round(Math.max(0, byMonth[month][category] || 0)),
      }));

      const current = monthlyData[2].amount;
      const previous = monthlyData[1].amount;
      const changePercent =
        previous > 0
          ? Math.round(((current - previous) / previous) * 100)
          : current > 0
            ? 100
            : 0;

      return {
        category,
        months: monthlyData,
        current_spend: current,
        previous_spend: previous,
        change_percent: changePercent,
      };
    });

    return NextResponse.json({
      months: months.map(m => {
        const [y, mo] = m.split('-');
        return {
          key: m,
          label: new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short' }),
        };
      }),
      categories,
    });
  } catch (error) {
    console.error('Error fetching category trends:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
