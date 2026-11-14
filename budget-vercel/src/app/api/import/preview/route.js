import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactionsFresh, getSettings } from '@/lib/sheets';
import { parseBankCsv } from '@/lib/import/parse';
import { detectAccount } from '@/lib/import/detect';
import { planImport } from '@/lib/import/plan';
import { accountVersion } from '@/lib/import/version';
import { accountKind, buildHistory } from '@/lib/rules';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That file is larger than 5 MB. Export a shorter date range and try again.' }, { status: 413 });
    }

    const { format, rows, errors } = parseBankCsv(await file.text());
    // A file that can't be read at all (unclosed quote, no date/amount columns) gets one clear message.
    const unreadable = errors.find((e) => e.file);
    if (unreadable) return NextResponse.json({ error: unreadable.reason, errors }, { status: 422 });
    // Duplicates are checked against the sheet as it is now, not the cache (which can miss a recent import).
    const [accounts, transactions, settings] = await Promise.all([
      getAccounts(false), getAllTransactionsFresh(), getSettings(),
    ]);
    const detection = detectAccount(rows, transactions, accounts);

    const requested = formData.get('account_id');
    let account = null;
    if (requested !== null && requested !== '') {
      account = accounts.find((a) => Number(a.id) === Number(requested));
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    } else if (detection.length > 0) {
      account = accounts.find((a) => Number(a.id) === Number(detection[0].account_id)) || null;
    }

    let plan = null;
    let message = null;
    if (account) {
      const accountTxns = transactions.filter((t) => Number(t.account_id) === Number(account.id));
      plan = planImport(rows, accountTxns, {
        kind: accountKind(account, settings),
        history: buildHistory(transactions),
      });
      const entry = detection.find((d) => Number(d.account_id) === Number(account.id));
      if (plan.new.length === 0 && entry && entry.ratio >= 0.95) {
        message = `Everything in this file is already in ${account.name}.`;
      }
    }

    return NextResponse.json({
      format,
      errors,
      total_rows: rows.length,
      detection,
      account_id: account ? account.id : null,
      account_name: account ? account.name : null,
      // Sent back with the commit, which refuses if the account changed in between.
      account_version: account ? accountVersion(transactions, account.id) : null,
      plan,
      message,
    });
  } catch (error) {
    console.error('Error previewing import:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
