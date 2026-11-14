import { test, expect, vi } from 'vitest';
import { listReceiptFolder, listReceiptFiles } from '@/lib/drive';
import { MAX_RECEIPT_FILES } from '@/lib/receipts';

const FOLDER = 'application/vnd.google-apps.folder';
const pdf = (id, name = `${id}.pdf`) => ({ id, name, mimeType: 'application/pdf', createdTime: '2026-10-01T00:00:00.000Z', webViewLink: `https://drive.example/${id}` });

// A fake Drive v3 client: `pages` maps a folder id to the pages files.list returns for it, in order.
function fakeDrive(pages) {
  const list = vi.fn(async ({ q, pageToken }) => {
    const folderId = q.match(/^'([^']+)' in parents/)[1];
    const i = pageToken ? Number(pageToken) : 0;
    const all = pages[folderId] || [[]];
    return { data: { files: all[i], nextPageToken: i + 1 < all.length ? String(i + 1) : undefined } };
  });
  const get = vi.fn(async () => ({ data: { id: 'root1234567', mimeType: FOLDER } }));
  return { files: { list, get } };
}

test('follows nextPageToken for the folder and its subfolders', async () => {
  const drive = fakeDrive({
    root1234567: [
      [pdf('a'), { id: 'sub2026', name: '2026', mimeType: FOLDER }],
      [pdf('b')],
    ],
    sub2026: [[pdf('c')], [pdf('d'), pdf('e')]],
  });
  const { files, truncated } = await listReceiptFolder('root1234567', drive);
  expect(files.map((f) => f.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  expect(files.map((f) => f.folder)).toEqual(['', '', '2026', '2026', '2026']);
  expect(truncated).toBe(false);
  // Second-page requests carry the token from the first page.
  expect(drive.files.list).toHaveBeenCalledWith(expect.objectContaining({ pageToken: '1', pageSize: 1000 }));
  expect(drive.files.list).toHaveBeenCalledTimes(4);
});

test('stops at the overall cap and says so', async () => {
  const page = (prefix, n) => Array.from({ length: n }, (_, i) => pdf(`${prefix}${i}`));
  const drive = fakeDrive({
    root1234567: [page('r', 1000), page('s', 1000), page('t', 1000), page('u', 1000), page('v', 1000), page('w', 1000)],
  });
  const { files, truncated } = await listReceiptFolder('root1234567', drive);
  expect(files).toHaveLength(MAX_RECEIPT_FILES);
  expect(truncated).toBe(true);
  // It does not keep paging once past the cap.
  expect(drive.files.list.mock.calls.length).toBeLessThan(7);
});

test('exactly the cap is not reported as truncated', async () => {
  const page = (prefix, n) => Array.from({ length: n }, (_, i) => pdf(`${prefix}${i}`));
  const drive = fakeDrive({ root1234567: [page('r', 1000), page('s', 1000), page('t', 1000), page('u', 1000), page('v', 1000)] });
  const { files, truncated } = await listReceiptFolder('root1234567', drive);
  expect(files).toHaveLength(MAX_RECEIPT_FILES);
  expect(truncated).toBe(false);
});

test('listReceiptFiles still returns the plain array', async () => {
  const drive = fakeDrive({ root1234567: [[pdf('a')]] });
  expect((await listReceiptFiles('root1234567', drive)).map((f) => f.id)).toEqual(['a']);
});
