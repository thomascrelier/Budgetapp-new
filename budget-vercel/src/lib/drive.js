import { google } from 'googleapis';
import { getAuth } from './google';
import { MAX_RECEIPT_FILES, isDriveId } from './receipts';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PAGE_SIZE = 1000;
const LIST_FIELDS = 'nextPageToken, files(id,name,mimeType,createdTime,webViewLink)';

const driveError = (code, message) => Object.assign(new Error(message), { code });
const isFolder = (f) => f.mimeType === FOLDER_MIME;
const defaultDrive = () => google.drive({ version: 'v3', auth: getAuth() });

// Every child of a folder, page by page. Stops early once it holds more than the cap's worth of files;
// `more` is then true so the caller can say the listing is incomplete.
async function listChildren(drive, folderId) {
  const items = [];
  let pageToken;
  let fileCount = 0;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: LIST_FIELDS,
      pageSize: PAGE_SIZE,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const page = res.data.files || [];
    items.push(...page);
    fileCount += page.filter((f) => !isFolder(f)).length;
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken && fileCount <= MAX_RECEIPT_FILES);
  return { items, more: Boolean(pageToken) };
}

const toFile = (f, folder) => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  createdTime: f.createdTime,
  webViewLink: f.webViewLink,
  folder,
});

// Files in the receipts folder and its direct subfolders (one level), trashed excluded, following every
// page. Returns { files, truncated }: truncated is true when more than MAX_RECEIPT_FILES exist and only
// the first ones are returned. `folder` is the subfolder's name, '' for files at the top.
// Throws Drive's error (403/404 when the folder isn't shared with the service account) for the caller to explain.
export async function listReceiptFolder(folderId, drive = defaultDrive()) {
  if (!isDriveId(folderId)) throw driveError('INVALID_FOLDER_ID', 'Receipts folder id is not a Drive id');

  // A search on an unshared folder returns an empty list, not an error; reading the folder itself
  // surfaces the 404 so the owner is told to share it.
  const folder = await drive.files.get({ fileId: folderId, fields: 'id,mimeType', supportsAllDrives: true });
  if (!isFolder(folder.data)) throw driveError('NOT_A_FOLDER', 'Receipts folder id is not a folder');

  const top = await listChildren(drive, folderId);
  const subfolders = top.items.filter(isFolder);
  const nested = await Promise.all(subfolders.map(async (sub) => {
    const r = await listChildren(drive, sub.id);
    return { files: r.items.filter((f) => !isFolder(f)).map((f) => toFile(f, sub.name || '')), more: r.more };
  }));

  const files = top.items.filter((f) => !isFolder(f)).map((f) => toFile(f, ''))
    .concat(...nested.map((n) => n.files));
  const truncated = top.more || nested.some((n) => n.more) || files.length > MAX_RECEIPT_FILES;
  return { files: files.slice(0, MAX_RECEIPT_FILES), truncated };
}

// The files alone (the CSV export only needs their links).
export async function listReceiptFiles(folderId, drive) {
  return (await listReceiptFolder(folderId, drive)).files;
}
