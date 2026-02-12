import { NextResponse } from 'next/server';
import { getAccountsWithBalances, createAccount, initializeDefaultAccounts } from '@/lib/sheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const accounts = await getAccountsWithBalances();
    return NextResponse.json({
      accounts: includeInactive ? accounts : accounts.filter(a => a.is_active),
      total: accounts.length,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.name) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    const account = await createAccount(data);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
