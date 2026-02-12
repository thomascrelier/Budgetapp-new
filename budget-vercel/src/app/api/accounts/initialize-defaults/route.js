import { NextResponse } from 'next/server';
import { initializeDefaultAccounts, initializeSheets } from '@/lib/sheets';

export async function POST() {
  try {
    // Initialize sheets first
    await initializeSheets();

    // Then create default accounts
    const result = await initializeDefaultAccounts();
    return NextResponse.json({
      ...result,
      message: `Created ${result.created.length} accounts, ${result.existing.length} already existed`,
    });
  } catch (error) {
    console.error('Error initializing accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
