import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { resolveAccountIds } from '@/lib/scope';
import { balanceSeries } from '@/lib/analytics';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 30;

    // Legacy single-account param maps onto account_ids
    const scoped = new URLSearchParams(searchParams);
    if (!scoped.get('account_ids') && scoped.get('account_id')) {
      scoped.set('account_ids', scoped.get('account_id'));
    }

    const [accounts, transactions, settings] = await Promise.all([
      getAccounts(),
      getAllTransactions(),
      getSettings(),
    ]);
    const accountIds = resolveAccountIds(scoped, accounts, settings);

    const data = balanceSeries(
      accounts.filter(a => accountIds.includes(a.id)),
      transactions.filter(t => accountIds.includes(t.account_id)),
      days,
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching balance history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
