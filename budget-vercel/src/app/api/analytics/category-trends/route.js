import { NextResponse } from 'next/server';
import { getAllTransactions } from '@/lib/sheets';

const TRACKED_CATEGORIES = ['Coffee Shops', 'Gas', 'Groceries', 'Dining'];

function getMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthRange(now, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    let year = now.getFullYear();
    let month = now.getMonth() + 1 - i;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    months.push(getMonthStr(year, month));
  }
  return months;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get('account_ids');
    const accountIds = accountIdsParam
      ? accountIdsParam.split(',').map(Number)
      : null;

    let transactions = await getAllTransactions();

    if (accountIds) {
      transactions = transactions.filter(t => accountIds.includes(t.account_id));
    }

    const now = new Date();
    const months = getMonthRange(now, 3); // current + 2 prior
    const monthSet = new Set(months);

    // Filter to tracked categories, relevant months, expenses only
    const relevant = transactions.filter(
      t =>
        monthSet.has(t.date.substring(0, 7)) &&
        TRACKED_CATEGORIES.includes(t.category) &&
        t.amount < 0
    );

    const categories = TRACKED_CATEGORIES.map(category => {
      const monthlyData = months.map(month => {
        const total = relevant
          .filter(t => t.category === category && t.date.substring(0, 7) === month)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return { month, amount: Math.round(total) };
      });

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
