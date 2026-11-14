import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { summarize, inMonth } from '@/lib/analytics';
import { lastNMonths } from '@/lib/dates';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months')) || 6;

    const [accounts, allTransactions, settings] = await Promise.all([
      getAccounts(),
      getAllTransactions(),
      getSettings(),
    ]);
    const accountIds = resolveAccountIds(searchParams, accounts, settings);
    const transactions = allTransactions.filter(t => accountIds.includes(t.account_id));

    const data = lastNMonths(months).map((month) => {
      const { income, spending, net } = summarize(inMonth(transactions, month));
      return { month, income, expenses: spending, net };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching cash flow:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
