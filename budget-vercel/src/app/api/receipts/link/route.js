import { NextResponse } from 'next/server';
import { getAllTransactions, linkReceipt, unlinkReceipt } from '@/lib/sheets';
import { isDriveId, validateLinkBody } from '@/lib/receipts';

// POST { drive_file_id, file_name, mime_type, transaction_id } -> { link }
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const result = validateLinkBody(body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    const txns = await getAllTransactions();
    if (!txns.some((t) => t.id === result.value.transaction_id)) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const link = await linkReceipt(result.value);
    return NextResponse.json({ link });
  } catch (error) {
    console.error('Error linking receipt:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE ?drive_file_id=… -> { unlinked: true }. Clears the link; the sheet row stays.
export async function DELETE(request) {
  try {
    const id = String(new URL(request.url).searchParams.get('drive_file_id') || '').trim();
    if (!id || !isDriveId(id)) return NextResponse.json({ error: 'drive_file_id must be a Drive file id.' }, { status: 400 });
    const found = await unlinkReceipt(id);
    if (!found) return NextResponse.json({ error: 'This receipt is not linked' }, { status: 404 });
    return NextResponse.json({ unlinked: true });
  } catch (error) {
    console.error('Error unlinking receipt:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
