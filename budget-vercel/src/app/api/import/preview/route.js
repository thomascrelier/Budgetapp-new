import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { parseBankCsv } from '@/lib/import/parse';
import { detectAccount } from '@/lib/import/detect';
import { planImport } from '@/lib/import/plan';
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
    const [accounts, transactions, settings] = await Promise.all([
      getAccounts(false), getAllTransactions(), getSettings(),
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
      plan,
      message,
    });
  } catch (error) {
    console.error('Error previewing import:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
