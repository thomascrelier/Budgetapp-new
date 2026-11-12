import { NextResponse } from 'next/server';
import { getTenants, saveTenant, getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { rentalAccount } from '@/lib/scope';
import { buildLedger } from '@/lib/rental/ledger';

export async function GET() {
  try {
    const [tenants, accounts, settings] = await Promise.all([getTenants(), getAccounts(true), getSettings()]);
    const active = tenants.filter((t) => t.is_active);
    const rental = rentalAccount(accounts, settings);
    if (!rental) {
      return NextResponse.json({ needs_setup: true, tenants: [], error: 'No rental account found' });
    }
    const txns = (await getAllTransactions()).filter((t) => t.account_id === rental.id);
    return NextResponse.json({
      needs_setup: active.length === 0,
      tenants: buildLedger({ txns, tenants: active, now: new Date() }),
      all_tenants: tenants,
    });
  } catch (error) {
    console.error('Error building tenant ledger:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tenant = await saveTenant(body);
    return NextResponse.json(tenant);
  } catch (error) {
    const invalid = String(error.message || '').startsWith('Invalid tenant');
    return NextResponse.json({ error: error.message }, { status: invalid ? 400 : 500 });
  }
}
