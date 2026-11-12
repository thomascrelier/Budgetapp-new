import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getReceiptLinks, getSettings } from '@/lib/sheets';
import { listReceiptFiles } from '@/lib/drive';
import { receiptColumn } from '@/lib/receipts';
import { rentalAccount } from '@/lib/scope';
import { parseAmount } from '@/lib/sheetRows';
import { currentMonth } from '@/lib/dates';
import { buildT776, toT776Csv } from '@/lib/rental/t776';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year'), 10) || parseInt(currentMonth().slice(0, 4), 10);
    const [accounts, settings, txns] = await Promise.all([getAccounts(true), getSettings(), getAllTransactions()]);
    const rental = rentalAccount(accounts, settings);
    if (!rental) return NextResponse.json({ error: 'No rental account found' }, { status: 404 });
    const mortgageInterest = parseAmount(settings[`mortgage_interest:${year}`]);
    const result = buildT776({ txns, year, rentalAccountId: rental.id, mortgageInterest });
    if (searchParams.get('format') === 'csv') {
      const links = await getReceiptLinks();
      // Drive links when the folder can be read; file names otherwise. The export never fails on Drive.
      let files = [];
      const folderId = String(settings.receipts_folder_id || '').trim();
      if (folderId && links.length) {
        try {
          files = await listReceiptFiles(folderId);
        } catch (err) {
          console.error('Drive: CSV export falls back to file names:', err?.code ?? '', err?.message ?? err);
        }
      }
      return new Response(toT776Csv(result, receiptColumn(links, files)), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="t776-${year}.csv"`,
        },
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error building T776:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
