import { NextResponse } from 'next/server';
import { getSettings, setSetting } from '@/lib/sheets';
import { serviceAccountEmail } from '@/lib/google';
import { normalizeSettingValue } from '@/lib/sheetRows';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings, service_account_email: serviceAccountEmail() });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { key, value } = body || {};
    if (typeof key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    const result = normalizeSettingValue(key, value);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await setSetting(key, result.value);
    return NextResponse.json({ key, value: result.value });
  } catch (error) {
    console.error('Error saving setting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
