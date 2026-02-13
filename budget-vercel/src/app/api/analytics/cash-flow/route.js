import { NextResponse } from 'next/server';
import { getAllTransactions } from '@/lib/sheets';

// Categories that represent money movement, not actual spending
const NON_SPENDING_CATEGORIES = ['Transfer', 'Transfers & Payments', 'Investments'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months')) || 6;
    const accountIdsParam = searchParams.get('account_ids');
    const accountIds = accountIdsParam ? accountIdsParam.split(',').map(Number) : null;

    let transactions = await getAllTransactions();

    if (accountIds) {
      transactions = transactions.filter(t => accountIds.includes(t.account_id));
    }

    const now = new Date();
    const data = [];

    for (let i = months - 1; i >= 0; i--) {
      let year = now.getFullYear();
      let month = now.getMonth() + 1 - i;

      while (month <= 0) {
        month += 12;
        year -= 1;
      }

      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));

      let income = 0;
      let expenses = 0;

      for (const t of monthTransactions) {
        const isNonSpending = NON_SPENDING_CATEGORIES.includes(t.category);
        if (t.amount > 0) income += t.amount;
        else if (!isNonSpending) expenses += Math.abs(t.amount);
      }

      data.push({
        month: monthStr,
        income,
        expenses,
        net: income - expenses,
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching cash flow:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
