import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { parseDelimited } from './csv.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SHEETS_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

export type SheetsMode = 'SERVICE_ACCOUNT' | 'PUBLIC_LINK' | 'NOT_CONFIGURED';

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
}

const normalizePrivateKey = (raw: string): string => raw.replace(/\\n/g, '\n').trim();

const decodeCredentialBlob = (raw: string): string => {
  const text = raw.trim().replace(/^['"]|['"]$/g, '');
  if (text.startsWith('{')) return text;
  try {
    return Buffer.from(text, 'base64').toString('utf8');
  } catch {
    return text;
  }
};

const parseServiceAccountJson = (raw: string): ServiceAccount => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeCredentialBlob(raw));
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole downloaded key file, or base64 encode it.'
    );
  }

  const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<
    string,
    unknown
  >;
  const clientEmail = typeof record.client_email === 'string' ? record.client_email : null;
  const privateKey = typeof record.private_key === 'string' ? record.private_key : null;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key. Use the service account key file, not an OAuth client file.'
    );
  }

  return { clientEmail, privateKey: normalizePrivateKey(privateKey) };
};

export const getServiceAccount = (): ServiceAccount | null => {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return parseServiceAccountJson(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return {
      clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: normalizePrivateKey(env.GOOGLE_SERVICE_ACCOUNT_KEY),
    };
  }
  return null;
};

export const sheetsMode = (): SheetsMode => {
  if (!env.GOOGLE_SHEETS_ID) return 'NOT_CONFIGURED';
  return getServiceAccount() ? 'SERVICE_ACCOUNT' : 'PUBLIC_LINK';
};

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export const isSheetsConfigured = (): boolean => sheetsMode() !== 'NOT_CONFIGURED';

const requestAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const account = getServiceAccount();
  if (!account) {
    throw new Error('Google service account credentials are not configured');
  }
  const { clientEmail, privateKey } = account;

  const issuedAt = Math.floor(now / 1000);
  const assertion = jwt.sign(
    {
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600,
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Google token response did not include an access token');
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
};

const fetchPublicSheetRows = async (): Promise<string[][]> => {
  const url = `https://docs.google.com/spreadsheets/d/${env.GOOGLE_SHEETS_ID}/export?format=csv&gid=${env.GOOGLE_SHEETS_GID}`;
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(
      `Could not read the sheet (${response.status}). Set link sharing to "Anyone with the link can view", or configure a service account.`
    );
  }

  const body = await response.text();
  if (body.trimStart().startsWith('<')) {
    throw new Error(
      'Google returned a sign-in page instead of the sheet. Set link sharing to "Anyone with the link can view", or configure a service account.'
    );
  }

  return parseDelimited(body);
};

const fetchServiceAccountRows = async (): Promise<string[][]> => {
  const token = await requestAccessToken();
  const range = encodeURIComponent(env.GOOGLE_SHEETS_RANGE);
  const url = `${SHEETS_ENDPOINT}/${env.GOOGLE_SHEETS_ID}/values/${range}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    const hint =
      response.status === 403 || response.status === 404
        ? ` Share the sheet with ${getServiceAccount()?.clientEmail ?? 'the service account'} as a Viewer, or clear the service account settings to read it as a public sheet.`
        : '';
    throw new Error(
      `Google Sheets request failed (${response.status}).${hint} ${detail.slice(0, 160)}`
    );
  }

  const payload = (await response.json()) as { values?: unknown[][] };
  const values = payload.values ?? [];

  return values.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
  );
};

export const fetchSheetRows = async (): Promise<string[][]> => {
  const mode = sheetsMode();
  if (mode === 'NOT_CONFIGURED') {
    throw new Error('Google Sheets is not connected. Set GOOGLE_SHEETS_ID.');
  }
  if (mode === 'PUBLIC_LINK') {
    return fetchPublicSheetRows();
  }

  try {
    return await fetchServiceAccountRows();
  } catch (error) {
    console.error('Service account fetch failed with error:', error);
    const rows = await fetchPublicSheetRows().catch(() => null);
    if (rows) {
      console.warn(
        'Service account could not read the sheet; used the public link instead. Share the sheet with the service account to stop relying on public access.'
      );
      return rows;
    }
    throw error;
  }
};
