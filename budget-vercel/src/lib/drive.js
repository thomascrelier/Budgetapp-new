import { google } from 'googleapis';
import { getAuth } from './google';
import { isDriveId } from './receipts';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_FILES = 1000;
const FILE_FIELDS = 'files(id,name,mimeType,createdTime,webViewLink)';

const driveError = (code, message) => Object.assign(new Error(message), { code });

async function listChildren(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: FILE_FIELDS,
    pageSize: MAX_FILES,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

const toFile = (f, folder) => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  createdTime: f.createdTime,
  webViewLink: f.webViewLink,
  folder,
});

// Files in the receipts folder and its direct subfolders (one level), trashed excluded, up to 1000.
// `folder` is the subfolder's name, '' for files at the top. Throws Drive's error (403/404 when the
// folder isn't shared with the service account) for the caller to explain.
export async function listReceiptFiles(folderId) {
  if (!isDriveId(folderId)) throw driveError('INVALID_FOLDER_ID', 'Receipts folder id is not a Drive id');
  const drive = google.drive({ version: 'v3', auth: getAuth() });

  // A search on an unshared folder returns an empty list, not an error; reading the folder itself
  // surfaces the 404 so the owner is told to share it.
  const folder = await drive.files.get({ fileId: folderId, fields: 'id,mimeType', supportsAllDrives: true });
  if (folder.data.mimeType !== FOLDER_MIME) throw driveError('NOT_A_FOLDER', 'Receipts folder id is not a folder');

  const top = await listChildren(drive, folderId);
  const files = top.filter((f) => f.mimeType !== FOLDER_MIME).map((f) => toFile(f, ''));
  const subfolders = top.filter((f) => f.mimeType === FOLDER_MIME);
  const nested = await Promise.all(subfolders.map(async (sub) =>
    (await listChildren(drive, sub.id)).filter((f) => f.mimeType !== FOLDER_MIME).map((f) => toFile(f, sub.name || ''))));
  return files.concat(...nested).slice(0, MAX_FILES);
}
