import { NextResponse } from 'next/server';
import { getBudgets, createBudget, getAllTransactions } from '@/lib/sheets';

export async function GET(request) {
  try {
    const budgets = await getBudgets();
    return NextResponse.json({ budgets });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.category_name || !data.monthly_limit) {
      return NextResponse.json(
        { error: 'category_name and monthly_limit are required' },
        { status: 400 }
      );
    }

    const budget = await createBudget(data);
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
