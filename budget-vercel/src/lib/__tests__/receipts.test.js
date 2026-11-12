import { test, expect, vi, beforeEach, describe } from 'vitest';
import {
  amountFromFilename,
  suggestMatches,
  missingReceipts,
  extractFolderId,
  driveErrorMessage,
  receiptFilesForYear,
  linkCandidates,
  receiptColumn,
  validateLinkBody,
} from '@/lib/receipts';

// The receipts route is exercised with its storage and Drive dependencies mocked (no Google credentials here).
vi.mock('@/lib/sheets', () => ({
  getAccounts: vi.fn(),
  getSettings: vi.fn(),
  getAllTransactions: vi.fn(),
  getReceiptLinks: vi.fn(),
}));
vi.mock('@/lib/drive', () => ({ listReceiptFolder: vi.fn() }));
vi.mock('@/lib/google', () => ({ serviceAccountEmail: vi.fn() }));

const EMAIL = 'receipts-bot@example-project.iam.gserviceaccount.com';

test('amountFromFilename', () => {
  expect(amountFromFilename('whirlpool-971.79.pdf')).toBe(971.79);
  expect(amountFromFilename('aviva_1955_88.jpg')).toBe(1955.88);
  expect(amountFromFilename('IMG_2231.jpg')).toBeNull();
});

test('amountFromFilename reads a comma decimal and ignores names without an amount', () => {
  expect(amountFromFilename('plumber 250,00.pdf')).toBe(250);
  expect(amountFromFilename('')).toBeNull();
  expect(amountFromFilename(undefined)).toBeNull();
});

test('suggestMatches only when exactly one transaction matches', () => {
  const files = [{ id: 'f1', name: 'stove 971.79.pdf' }, { id: 'f2', name: 'x 10.00.pdf' }];
  const txns = [{ id: 1, amount: -971.79 }, { id: 2, amount: -10 }, { id: 3, amount: -10 }];
  expect(Object.fromEntries(suggestMatches(files, txns))).toEqual({ f1: 1 });
});

test('suggestMatches makes no suggestion when nothing matches', () => {
  const files = [{ id: 'f1', name: 'invoice 12.34.pdf' }, { id: 'f2', name: 'scan.jpg' }];
  expect(suggestMatches(files, [{ id: 1, amount: -99.99 }]).size).toBe(0);
});

test('missingReceipts lists capital and larger expense items without links', () => {
  const t776 = { capital: [{ txn: { id: 1, amount: -971.79 } }], lines: [{ code: '8960', items: [{ id: 2, amount: -900 }, { id: 3, amount: -20 }] }] };
  expect(missingReceipts(t776, [{ drive_file_id: 'f', transaction_id: 2 }]).map(t => t.id)).toEqual([1]);
});

test('missingReceipts ignores rent deposits and unlinked link rows', () => {
  const t776 = {
    capital: [],
    lines: [
      { code: '8141', items: [{ id: 10, amount: 2000 }] },
      { code: '8690', items: [{ id: 11, amount: -1200 }] },
    ],
  };
  // A cleared link row (transaction_id null) does not count as a receipt on file.
  expect(missingReceipts(t776, [{ drive_file_id: 'f', transaction_id: null }]).map(t => t.id)).toEqual([11]);
});

test('extractFolderId accepts a folder link or a bare id', () => {
  expect(extractFolderId('https://drive.google.com/drive/folders/1AbC_def-GHIjklMNOpq?usp=sharing')).toBe('1AbC_def-GHIjklMNOpq');
  expect(extractFolderId('https://drive.google.com/drive/u/0/folders/1AbC_def-GHIjklMNOpq')).toBe('1AbC_def-GHIjklMNOpq');
  expect(extractFolderId('https://drive.google.com/open?id=1AbC_def-GHIjklMNOpq')).toBe('1AbC_def-GHIjklMNOpq');
  expect(extractFolderId('  1AbC_def-GHIjklMNOpq  ')).toBe('1AbC_def-GHIjklMNOpq');
  expect(extractFolderId('not a folder')).toBeNull();
  expect(extractFolderId('')).toBeNull();
});

describe('driveErrorMessage', () => {
  const share = `The app can't open this folder. Share it with ${EMAIL} as Viewer.`;
  test('403 and 404 from Drive ask the owner to share the folder with the service account', () => {
    expect(driveErrorMessage({ code: 403, errors: [{ reason: 'insufficientFilePermissions' }] }, EMAIL)).toBe(share);
    expect(driveErrorMessage({ code: 404, errors: [{ reason: 'notFound' }] }, EMAIL)).toBe(share);
    expect(driveErrorMessage({ response: { status: 404 } }, EMAIL)).toBe(share);
  });
  test('without a known email the message still explains the fix', () => {
    expect(driveErrorMessage({ code: 404 }, null)).toBe("The app can't open this folder. Share it with the app's service account as Viewer.");
  });
  test('a disabled Drive API is not reported as a sharing problem', () => {
    const msg = driveErrorMessage({ code: 403, errors: [{ reason: 'accessNotConfigured' }] }, EMAIL);
    expect(msg).toMatch(/Google Drive API/);
    expect(msg).not.toMatch(/Share it/);
  });
  test('rate limits and other failures get a generic retry message', () => {
    const generic = "Couldn't read the receipts folder from Google Drive. Try again in a minute.";
    expect(driveErrorMessage({ code: 403, errors: [{ reason: 'userRateLimitExceeded' }] }, EMAIL)).toBe(generic);
    expect(driveErrorMessage({ code: 500 }, EMAIL)).toBe(generic);
    expect(driveErrorMessage(new Error('socket hang up'), EMAIL)).toBe(generic);
    expect(driveErrorMessage(undefined, EMAIL)).toBe(generic);
  });
  test('a stored value that is not a folder gets a specific message', () => {
    expect(driveErrorMessage({ code: 'NOT_A_FOLDER' }, EMAIL)).toMatch(/not a folder/);
    expect(driveErrorMessage({ code: 'INVALID_FOLDER_ID' }, EMAIL)).toMatch(/folder link or ID/);
  });
});

describe('receiptFilesForYear', () => {
  const txns = [
    { id: 1, date: '2026-08-31', description: 'Appliance store', amount: -971.79, tax_tag: 'Capital CCA 8' },
    { id: 2, date: '2025-04-21', description: 'Plumber', amount: -250, tax_tag: '' },
    { id: 3, date: '2026-09-15', description: 'Insurer', amount: -1955.88, tax_tag: '' },
    { id: 4, date: '2026-06-15', description: 'Plumber', amount: -900, tax_tag: '' },
  ];
  const file = (id, name, folder = '', createdTime = '2026-10-01T00:00:00.000Z') =>
    ({ id, name, mimeType: 'application/pdf', createdTime, webViewLink: `https://drive.example/${id}`, folder });

  test('keeps files linked to this year, unlinked files outside other-year folders, and suggests matches', () => {
    const files = [
      file('a', 'stove.pdf'),
      file('b', 'old-invoice.pdf'),
      file('c', 'insurer 1955.88.pdf', '', '2026-11-01T00:00:00.000Z'),
      file('d', 'plumber 900.00.pdf', '2025'),
      file('e', 'plumber 900.00.jpg', '2026 receipts'),
    ];
    const links = [
      { drive_file_id: 'a', transaction_id: 1 },
      { drive_file_id: 'b', transaction_id: 2 },
    ];
    const candidates = [txns[0], txns[2], txns[3]];
    const out = receiptFilesForYear({ files, links, txns, candidates, year: 2026 });
    // Newest first, then by name.
    expect(out.map(f => f.id)).toEqual(['c', 'e', 'a']);
    const byId = Object.fromEntries(out.map(f => [f.id, f]));
    expect(byId.a.transaction_id).toBe(1);
    expect(byId.a.transaction).toEqual(expect.objectContaining({ id: 1, description: 'Appliance store' }));
    expect(byId.a.suggested_transaction_id).toBeNull();
    expect(byId.c.transaction_id).toBeNull();
    expect(byId.c.suggested_transaction_id).toBe(3);
    expect(byId.e.suggested_transaction_id).toBe(4);
  });

  test('a transaction that already has a receipt is not suggested again', () => {
    const files = [file('a', 'stove.pdf'), file('x', 'copy 971.79.pdf')];
    const out = receiptFilesForYear({
      files, links: [{ drive_file_id: 'a', transaction_id: 1 }], txns, candidates: [txns[0]], year: 2026,
    });
    expect(out.find(f => f.id === 'x').suggested_transaction_id).toBeNull();
  });
});

test('linkCandidates lists expense, capital and review items but not rent deposits', () => {
  const t776 = {
    lines: [
      { code: '8141', items: [{ id: 1, amount: 2000 }] },
      { code: '8690', items: [{ id: 2, amount: -500 }] },
    ],
    capital: [{ txn: { id: 3, amount: -971.79 }, cca_class: '8' }],
    review: [{ id: 4, amount: -80 }],
  };
  expect(linkCandidates(t776).map(t => t.id)).toEqual([2, 3, 4]);
});

test('receiptColumn maps each linked transaction to its Drive link, or the file name when Drive is unavailable', () => {
  const links = [
    { drive_file_id: 'a', file_name: 'stove.pdf', transaction_id: 1 },
    { drive_file_id: 'b', file_name: 'insurer.pdf', transaction_id: 3 },
    { drive_file_id: 'c', file_name: 'unlinked.pdf', transaction_id: null },
  ];
  const files = [{ id: 'a', name: 'stove.pdf', webViewLink: 'https://drive.example/a' }];
  const map = receiptColumn(links, files);
  expect(map.get(1)).toBe('https://drive.example/a');
  expect(map.get(3)).toBe('insurer.pdf');
  expect(map.size).toBe(2);
});

test('validateLinkBody requires a Drive file id and a transaction id', () => {
  expect(validateLinkBody({ drive_file_id: 'abc_DEF-123', file_name: 'x.pdf', mime_type: 'application/pdf', transaction_id: 7 }))
    .toEqual({ value: { drive_file_id: 'abc_DEF-123', file_name: 'x.pdf', mime_type: 'application/pdf', transaction_id: 7 } });
  expect(validateLinkBody({ drive_file_id: 'abc', transaction_id: '7' }).value.transaction_id).toBe(7);
  expect(validateLinkBody({ drive_file_id: '', transaction_id: 7 }).error).toBeTruthy();
  expect(validateLinkBody({ drive_file_id: "a' or 'b", transaction_id: 7 }).error).toBeTruthy();
  expect(validateLinkBody({ drive_file_id: 'abc', transaction_id: 0 }).error).toBeTruthy();
  expect(validateLinkBody(null).error).toBeTruthy();
});

// Review Focus 5: an unset or unshared folder must explain the fix, never fail the request.
describe('GET /api/receipts', () => {
  let sheets;
  let drive;
  let google;
  let GET;

  beforeEach(async () => {
    sheets = await import('@/lib/sheets');
    drive = await import('@/lib/drive');
    google = await import('@/lib/google');
    ({ GET } = await import('@/app/api/receipts/route'));
    vi.clearAllMocks();
    sheets.getAccounts.mockResolvedValue([{ id: 5, name: 'Rental Chequing', is_active: true }]);
    sheets.getAllTransactions.mockResolvedValue([
      { id: 1, account_id: 5, date: '2026-06-15', description: 'Plumber', amount: -900, category: 'Repairs & Maintenance', tax_tag: '', notes: '' },
    ]);
    sheets.getReceiptLinks.mockResolvedValue([]);
    google.serviceAccountEmail.mockReturnValue(EMAIL);
  });

  const call = () => GET(new Request('http://localhost/api/receipts?year=2026'));

  test('no folder set: 200, not configured, the service account email to share with', async () => {
    sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing' });
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(expect.objectContaining({
      folder_configured: false, folder_id: null, service_account_email: EMAIL, error: null, files: [],
    }));
    expect(body.missing.map(t => t.id)).toEqual([1]);
    expect(body.truncated).toBe(false);
    expect(drive.listReceiptFolder).not.toHaveBeenCalled();
  });

  test('folder not shared (Drive 404): 200 with the sharing instructions', async () => {
    sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing', receipts_folder_id: 'folder123' });
    drive.listReceiptFolder.mockRejectedValue(Object.assign(new Error('File not found: folder123.'), { code: 404 }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folder_configured).toBe(true);
    expect(body.folder_id).toBe('folder123');
    expect(body.error).toBe(`The app can't open this folder. Share it with ${EMAIL} as Viewer.`);
    expect(body.files).toEqual([]);
    expect(body.missing.map(t => t.id)).toEqual([1]);
  });

  test('other Drive failures: 200 with a generic message', async () => {
    sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing', receipts_folder_id: 'folder123' });
    drive.listReceiptFolder.mockRejectedValue(Object.assign(new Error('Backend Error'), { code: 503 }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("Couldn't read the receipts folder from Google Drive. Try again in a minute.");
  });

  test('files come back annotated with links and suggestions', async () => {
    sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing', receipts_folder_id: 'folder123' });
    drive.listReceiptFolder.mockResolvedValue({
      files: [
        { id: 'f1', name: 'plumber 900.00.pdf', mimeType: 'application/pdf', createdTime: '2026-07-01T00:00:00.000Z', webViewLink: 'https://drive.example/f1', folder: '' },
      ],
      truncated: false,
    });
    const body = await (await call()).json();
    expect(body.error).toBeNull();
    expect(body.truncated).toBe(false);
    expect(body.files).toEqual([expect.objectContaining({ id: 'f1', transaction_id: null, suggested_transaction_id: 1 })]);
  });

  test('a folder past the file cap is flagged as truncated', async () => {
    sheets.getSettings.mockResolvedValue({ rental_account_name: 'Rental Chequing', receipts_folder_id: 'folder123' });
    drive.listReceiptFolder.mockResolvedValue({ files: [], truncated: true });
    const body = await (await call()).json();
    expect(body.truncated).toBe(true);
  });
});
