import { test, expect, vi, beforeEach, describe } from 'vitest';

// The tenants route with sheet storage mocked (no Google credentials here).
vi.mock('@/lib/sheets', () => ({
  getTenants: vi.fn(),
  saveTenant: vi.fn(),
  getAccounts: vi.fn(),
  getAllTransactions: vi.fn(),
  getSettings: vi.fn(),
}));

describe('POST /api/rental/tenants', () => {
  let sheets;
  let POST;

  beforeEach(async () => {
    sheets = await import('@/lib/sheets');
    ({ POST } = await import('@/app/api/rental/tenants/route'));
    vi.clearAllMocks();
  });

  const call = (body) => POST(new Request('http://localhost/api/rental/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }));

  test('malformed JSON is a 400 and writes nothing', async () => {
    const res = await call('{"name": "Tenant A"');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/json/i);
    expect(sheets.saveTenant).not.toHaveBeenCalled();
  });

  test('an invalid tenant is a 400', async () => {
    sheets.saveTenant.mockRejectedValue(new Error('Invalid tenant: name is required'));
    const res = await call(JSON.stringify({ name: '' }));
    expect(res.status).toBe(400);
  });
});
