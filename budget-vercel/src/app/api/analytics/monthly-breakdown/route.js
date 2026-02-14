import { NextResponse } from 'next/server';
import { getAllTransactions } from '@/lib/sheets';

// Categories that represent money movement, not actual spending
const NON_SPENDING_CATEGORIES = ['Transfer', 'Transfers & Payments', 'Investments'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const accountIdsParam = searchParams.get('account_ids');
    const accountIds = accountIdsParam ? accountIdsParam.split(',').map(Number) : null;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month parameter is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    let transactions = await getAllTransactions();

    // Filter to the specified month
    transactions = transactions.filter(t => t.date.startsWith(month));

    // Filter by account_ids if provided
    if (accountIds) {
      transactions = transactions.filter(t => accountIds.includes(t.account_id));
    }

    // Calculate income and expenses (excluding non-spending categories)
    let income = 0;
    let expenses = 0;

    for (const t of transactions) {
      const isNonSpending = NON_SPENDING_CATEGORIES.includes(t.category);
      if (t.amount > 0 && !isNonSpending) income += t.amount;
      else if (t.amount < 0 && !isNonSpending) expenses += Math.abs(t.amount);
    }

    // Build category breakdown
    const categoryMap = {};
    for (const t of transactions) {
      const isNonSpending = NON_SPENDING_CATEGORIES.includes(t.category);
      if (isNonSpending) continue;

      const cat = t.category || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, total: 0, count: 0 };
      }
      categoryMap[cat].total += t.amount;
      categoryMap[cat].count += 1;
    }

    const category_breakdown = Object.values(categoryMap)
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // Build daily spending (negative amounts only, excluding non-spending)
    const dailyMap = {};

    // Determine all days in the month
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Cap to today if current month
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() + 1 === monthNum;
    const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      dailyMap[dateStr] = 0;
    }

    for (const t of transactions) {
      const isNonSpending = NON_SPENDING_CATEGORIES.includes(t.category);
      if (t.amount < 0 && !isNonSpending && dailyMap.hasOwnProperty(t.date)) {
        dailyMap[t.date] += Math.abs(t.amount);
      }
    }

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulative = 0;
    const daily_spending = sortedDates.map(date => {
      cumulative += dailyMap[date];
      return {
        date,
        amount: dailyMap[date],
        cumulative,
      };
    });

    // Top 10 transactions by absolute amount (excluding non-spending)
    const top_transactions = transactions
      .filter(t => !NON_SPENDING_CATEGORIES.includes(t.category))
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
      expenses,
      net: income - expenses,
      category_breakdown,
      daily_spending,
      top_transactions,
    });
  } catch (error) {
    console.error('Error fetching monthly breakdown:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
