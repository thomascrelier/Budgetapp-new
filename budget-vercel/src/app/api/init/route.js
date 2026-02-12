import { NextResponse } from 'next/server';
import { initializeSheets, initializeDefaultAccounts } from '@/lib/sheets';

export async function POST() {
  try {
    // Initialize sheets with headers
    await initializeSheets();

    // Create default accounts
    const result = await initializeDefaultAccounts();

    return NextResponse.json({
      success: true,
      message: 'Sheets initialized and default accounts created',
      accounts: result
    });
  } catch (error) {
    console.error('Error initializing:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
