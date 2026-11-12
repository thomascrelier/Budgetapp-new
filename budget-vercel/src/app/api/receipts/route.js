import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getReceiptLinks, getSettings } from '@/lib/sheets';
import { listReceiptFolder } from '@/lib/drive';
import { serviceAccountEmail } from '@/lib/google';
import { rentalAccount } from '@/lib/scope';
import { parseAmount } from '@/lib/sheetRows';
import { currentMonth } from '@/lib/dates';
import { buildT776 } from '@/lib/rental/t776';
import { driveErrorMessage, linkCandidates, missingReceipts, receiptFilesForYear } from '@/lib/receipts';

// GET /api/receipts?year=YYYY -> the receipts folder's files for the year, matched to transactions.
// Drive problems (folder unset, not shared, Drive down) come back as 200 with `error`, never a failure,
// so the Tax view can explain the fix.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year'), 10) || parseInt(currentMonth().slice(0, 4), 10);
    const [accounts, settings, txns, links] = await Promise.all([
      getAccounts(true), getSettings(), getAllTransactions(), getReceiptLinks(),
    ]);
    const email = serviceAccountEmail();
    // A folder saved on the Tax tab wins; GOOGLE_RECEIPTS_FOLDER_ID is the fallback.
    const folderId = String(settings.receipts_folder_id || process.env.GOOGLE_RECEIPTS_FOLDER_ID || '').trim();
    const rental = rentalAccount(accounts, settings);
    // Same inputs as /api/rental/t776, so `missing` matches the T776 the view shows.
    const t776 = buildT776({
      txns,
      year,
      rentalAccountId: rental ? rental.id : null,
      mortgageInterest: parseAmount(settings[`mortgage_interest:${year}`]),
    });

    let driveFiles = [];
    let truncated = false;
    let error = null;
    if (folderId) {
      try {
        ({ files: driveFiles, truncated } = await listReceiptFolder(folderId));
      } catch (err) {
        console.error('Drive: could not list the receipts folder:', err?.code ?? '', err?.message ?? err);
        error = driveErrorMessage(err, email);
      }
    }

    return NextResponse.json({
      year,
      folder_configured: Boolean(folderId),
      folder_id: folderId || null,
      service_account_email: email,
      error,
      truncated,
      files: receiptFilesForYear({ files: driveFiles, links, txns, candidates: linkCandidates(t776), year }),
      missing: missingReceipts(t776, links),
    });
  } catch (error) {
    console.error('Error loading receipts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
