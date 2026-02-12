import { NextResponse } from 'next/server';
import { getBudgets, getAllTransactions } from '@/lib/sheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    // Parse month or use current
    let year, month;
    if (monthParam) {
      [year, month] = monthParam.split('-').map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const budgets = await getBudgets();
    const transactions = await getAllTransactions();

    // Filter transactions for the month
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));

    // Calculate spending per category
    const spendingByCategory = {};
    for (const t of monthTransactions) {
      if (t.amount < 0) {
        const cat = t.category || 'Uncategorized';
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount);
      }
    }

    // Build budget status
    const budgetStatus = budgets.map(budget => {
      const spent = spendingByCategory[budget.category_name] || 0;
      const percentageUsed = budget.monthly_limit > 0
        ? (spent / budget.monthly_limit) * 100
        : 0;

      let status = 'on_track';
      if (percentageUsed >= 100) status = 'exceeded';
      else if (percentageUsed >= budget.alert_threshold) status = 'warning';

      return {
        ...budget,
        spent,
        remaining: Math.max(0, budget.monthly_limit - spent),
        percentage_used: percentageUsed,
        status,
      };
    });

    return NextResponse.json({
      budgets: budgetStatus,
      month: monthStr,
    });
  } catch (error) {
    console.error('Error fetching budget status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
