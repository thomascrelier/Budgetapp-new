import { test, expect, vi, beforeEach, describe } from 'vitest';

// The route is exercised with sheet storage mocked (no Google credentials here).
vi.mock('@/lib/sheets', () => ({ updateTransactionFields: vi.fn() }));

describe('PATCH /api/transactions/[id]', () => {
  let sheets;
  let PATCH;

  beforeEach(async () => {
    sheets = await import('@/lib/sheets');
    ({ PATCH } = await import('@/app/api/transactions/[id]/route'));
    vi.clearAllMocks();
  });

  const call = (body) => PATCH(
    new Request('http://localhost/api/transactions/7', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
    { params: Promise.resolve({ id: '7' }) },
  );

  test('malformed JSON is a 400 and writes nothing', async () => {
    const res = await call('{"category": "Groceries"');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/json/i);
    expect(sheets.updateTransactionFields).not.toHaveBeenCalled();
  });

  test('a valid body updates the named fields', async () => {
    sheets.updateTransactionFields.mockResolvedValue({ id: 7, notes: 'Kitchen tap' });
    const res = await call(JSON.stringify({ notes: 'Kitchen tap', ignored: 1 }));
    expect(res.status).toBe(200);
    expect(sheets.updateTransactionFields).toHaveBeenCalledWith(7, { notes: 'Kitchen tap' });
  });

  test('an unknown id is a 404', async () => {
    sheets.updateTransactionFields.mockRejectedValue(new Error('Transaction not found'));
    const res = await call(JSON.stringify({ category: 'Groceries' }));
    expect(res.status).toBe(404);
  });
});
