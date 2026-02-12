import { NextResponse } from 'next/server';
import { updateTransactionCategory } from '@/lib/sheets';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const { category } = await request.json();

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    await updateTransactionCategory(id, category);
    return NextResponse.json({ success: true, category });
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
