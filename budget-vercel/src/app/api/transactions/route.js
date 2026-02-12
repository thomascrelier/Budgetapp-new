import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/sheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      account_id: searchParams.get('account_id'),
      category: searchParams.get('category'),
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      skip: parseInt(searchParams.get('skip')) || 0,
      limit: parseInt(searchParams.get('limit')) || 50,
    };

    const result = await getTransactions(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
