import { test, expect, vi, beforeEach } from 'vitest';

// The rental overview route with sheet storage mocked (no Google credentials here).
vi.mock('@/lib/sheets', () => ({
  getAccounts: vi.fn(),
  getAllTransactions: vi.fn(),
  getSettings: vi.fn(),
}));

let sheets;
let GET;

beforeEach(async () => {
  sheets = await import('@/lib/sheets');
  ({ GET } = await import('@/app/api/analytics/rental-property/route'));
  vi.clearAllMocks();
  sheets.getAccounts.mockResolvedValue([{ id: 2, name: 'CIBC Rental', is_active: true }]);
  sheets.getSettings.mockResolvedValue({});
});

test('a returned rent payment reduces rental income and is not an expense', async () => {
  const row = (id, date, description, amount, category) => ({ id, account_id: 2, date, description, amount, category });
  sheets.getAllTransactions.mockResolvedValue([
    row(1, '2025-03-01', 'E-TRANSFER Tenant A', 2450, 'Rental Income'),
    row(2, '2025-03-02', 'E-TRANSFER RETURNED Tenant A', -2450, 'Rental Income'),
    row(3, '2025-03-03', 'E-TRANSFER Tenant A', 2450, 'Rental Income'),
    row(4, '2025-03-10', 'HYDRO', -180, 'Electricity'),
  ]);
  const body = await (await GET(new Request('http://localhost/api/analytics/rental-property?year=2025'))).json();
  expect(body.annual_summary).toEqual({ total_income: 2450, total_expenses: 180, net_income: 2270 });
  expect(body.monthly_data[2]).toMatchObject({ month: '2025-03', income: 2450, expenses: 180, net: 2270 });
  const rent = body.category_breakdown.find((c) => c.category === 'Rental Income');
  expect(rent).toMatchObject({ selected_year_total: 2450, transaction_count: 3, is_income: true });
});
