import { NextResponse } from 'next/server';
import { createTransactions, getAccountById } from '@/lib/sheets';
import { importBatchId, validateCommitRows } from '@/lib/import/batch';
import { accountVersion } from '@/lib/import/version';

const CHANGED = 'This account changed since the preview. Review the file again.';

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

    // The rows were planned against the preview's read of this account. Recheck on the fresh read the
    // append itself uses: if the account gained or lost rows since, the plan may hold duplicates.
    const expected = typeof body?.account_version === 'string' ? body.account_version : null;
    let changed = false;
    const verify = (fresh) => {
      if (accountVersion(fresh, accountId) !== expected) {
        changed = true;
        throw new Error(CHANGED);
      }
    };

    const import_batch_id = importBatchId();
    let result;
    try {
      result = await createTransactions(
        rows.map((r) => ({ ...r, account_id: accountId, is_verified: false, import_batch_id })),
        { verify },
      );
    } catch (err) {
      if (changed) return NextResponse.json({ error: CHANGED }, { status: 409 });
      throw err;
    }
    return NextResponse.json({ created: result.created, first_id: result.first_id, import_batch_id });
  } catch (error) {
    console.error('Error committing import:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
