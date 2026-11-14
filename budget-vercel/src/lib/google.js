import { google } from 'googleapis';

let _auth = null;

// One shared, memoized GoogleAuth for Sheets and Drive (read-only).
export function getAuth() {
  if (_auth) return _auth;
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  return _auth;
}

export function serviceAccountEmail() {
  try {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '');
    return typeof creds?.client_email === 'string' && creds.client_email ? creds.client_email : null;
  } catch {
    return null;
  }
}
