import { NextResponse } from 'next/server';
import { updateTransactionFields } from '@/lib/sheets';

const FIELDS = ['category', 'notes', 'tax_tag'];

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const fields = {};
    for (const name of FIELDS) {
      if (typeof body?.[name] === 'string') fields[name] = body[name];
    }
    if (fields.category !== undefined && fields.category.trim() === '') {
      return NextResponse.json({ error: 'Category cannot be empty' }, { status: 400 });
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const transaction = await updateTransactionFields(parseInt(id), fields);
    return NextResponse.json({ transaction });
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message === 'Duplicate transaction id') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
