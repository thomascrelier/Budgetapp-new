import { NextResponse } from 'next/server';
import { createTransactions, getAccountById } from '@/lib/sheets';
import { importBatchId, validateCommitRows } from '@/lib/import/batch';

export async function POST(request) {
  try {
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const accountId = Number(body?.account_id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'Choose an account' }, { status: 400 });
    }
    const { rows, error } = validateCommitRows(body?.rows);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const account = await getAccountById(accountId);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 400 });

    const import_batch_id = importBatchId();
    const { created, first_id } = await createTransactions(
      rows.map((r) => ({ ...r, account_id: accountId, is_verified: false, import_batch_id })),
    );
    return NextResponse.json({ created, first_id, import_batch_id });
  } catch (error) {
    console.error('Error committing import:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
