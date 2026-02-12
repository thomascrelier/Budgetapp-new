import { NextResponse } from 'next/server';
import { getAllTransactions, getAccountByName } from '@/lib/sheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();

    // Get Rental Property account
    const rentalAccount = await getAccountByName('Rental Property');
    if (!rentalAccount) {
      return NextResponse.json({
        error: 'Rental Property account not found',
        monthly_data: [],
        utility_breakdown: [],
        annual_summary: { total_income: 0, total_expenses: 0, net_income: 0 },
      });
    }

    const transactions = await getAllTransactions();
    const rentalTransactions = transactions.filter(
      t => t.account_id === rentalAccount.id && t.date.startsWith(String(year))
    );

    // Define utility categories
    const utilityCategories = ['Electricity', 'Gas', 'Water', 'Internet', 'Insurance', 'Property Tax', 'Maintenance', 'HOA'];

    // Monthly data
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const monthTransactions = rentalTransactions.filter(t => t.date.startsWith(monthStr));

      let income = 0;
      let expenses = 0;

      for (const t of monthTransactions) {
        if (t.amount > 0) income += t.amount;
        else expenses += Math.abs(t.amount);
      }

      monthlyData.push({
        month: monthStr,
        month_name: new Date(year, month - 1).toLocaleString('en-US', { month: 'short' }),
        income,
        expenses,
        net: income - expenses,
      });
    }

    // Utility breakdown
    const utilityBreakdown = utilityCategories.map(category => {
      const categoryTransactions = rentalTransactions.filter(
        t => t.category === category && t.amount < 0
      );
      const total = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const monthly_avg = total / 12;

      return {
        category,
        total,
        monthly_avg,
        transaction_count: categoryTransactions.length,
      };
    }).filter(u => u.total > 0);

    // Annual summary
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of rentalTransactions) {
      if (t.amount > 0) totalIncome += t.amount;
      else totalExpenses += Math.abs(t.amount);
    }

    return NextResponse.json({
      monthly_data: monthlyData,
      utility_breakdown: utilityBreakdown,
      annual_summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_income: totalIncome - totalExpenses,
      },
      year,
    });
  } catch (error) {
    console.error('Error fetching rental property analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
