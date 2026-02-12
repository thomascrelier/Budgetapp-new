import { NextResponse } from 'next/server';
import { clearCache } from '@/lib/sheets';

export async function POST() {
  clearCache();
  return NextResponse.json({ success: true, message: 'Cache cleared. Next request will fetch fresh data from Google Sheets.' });
}
