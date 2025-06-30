/**
 * Google Drive Integration:
 *
 * - Fetches a list of files from a specific Google Drive folder.
 * - Downloads file content as a Buffer (no writing to disk).
 * - Uploads processed files (e.g. OCR output) back to Drive.
 */

import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import stream from 'stream';
import { formatError } from '@lib/helpers';

dotenv.config();

// 📁 Load environment variables
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL!;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : '';
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const GOOGLE_DRIVE_FOLDER_OCR_ID = process.env.GOOGLE_DRIVE_FOLDER_OCR_ID!;

// 🔑 Reusable Drive client initializer
function getDriveClient(scope: string) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: [scope],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * 📂 Fetches files from the specified Google Drive folder.
 *
 * Use this to retrieve files for a specific upsert target or OCR workflow.
 *
 * 📥 Input:
 *   - folderId: string (explicit Google Drive folder ID to fetch from)
 *   - label: optional display label for logging (e.g., "forms" or "OCR")
 */
export async function fetchGoogleDriveFiles(folderId: string, label?: string) {
  const drive = getDriveClient(
    'https://www.googleapis.com/auth/drive.readonly'
  );

  if (!folderId) {
    throw new Error(
      `Missing Google Drive Folder ID for ${label ?? 'unspecified'} folder`
    );
  }

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const files = response.data.files || [];
    console.log(
      `📂 Fetched ${files.length} files from Google Drive${label ? ` (${label})` : ''}`
    );

    return files;
  } catch (error) {
    console.error('❌ Error fetching files from Google Drive:', error);
    throw new Error(
      `Error fetching files from Google Drive: ${formatError(
        error,
        String(error)
      )}`
    );
  }
}

/** 🔍 Finds a file by exact name in the default folder */
export async function findFileByExactName(fileName: string) {
  const drive = getDriveClient(
    'https://www.googleapis.com/auth/drive.readonly'
  );

  try {
    const response = await drive.files.list({
      q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const file = response.data.files?.[0] ?? null;
    if (file) {
      console.log(`✅ Found file by name: ${fileName}`);
    } else {
      console.warn(`❌ File not found: ${fileName}`);
    }

    return file;
  } catch (error) {
    console.error('Error finding file by exact name:', error);
    throw new Error(
      `Error finding file by exact name "${fileName}": ${formatError(
        error,
        String(error)
      )}`
    );
  }
}

/** 📥 Downloads a file's content as a Buffer (no disk writing) */
export async function downloadFileContent(
  fileId: string
): Promise<Buffer | null> {
  const drive = getDriveClient(
    'https://www.googleapis.com/auth/drive.readonly'
  );

  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const bufferChunks: Buffer[] = [];
    const bufferStream = new stream.Writable({
      write(chunk, encoding, callback) {
        bufferChunks.push(Buffer.from(chunk));
        callback();
      },
    });

    await new Promise((resolve, reject) => {
      response.data
        .pipe(bufferStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    return Buffer.concat(bufferChunks);
  } catch (error) {
    console.error(`Error downloading file content (ID: ${fileId}):`, error);
    throw new Error(
      `Error downloading file content (ID: ${fileId}): ${formatError(
        error,
        String(error)
      )}`
    );
  }
}

/** 📤 Uploads a file buffer to the OCR folder in Google Drive */
export async function uploadFileToDrive(
  buffer: Buffer,
  fileName: string
): Promise<{ id: string; name: string }> {
  const drive = getDriveClient('https://www.googleapis.com/auth/drive');

  const fileMetadata = {
    name: fileName,
    parents: [GOOGLE_DRIVE_FOLDER_OCR_ID],
  };

  const media = {
    mimeType: 'application/pdf',
    body: stream.Readable.from(buffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name',
    supportsAllDrives: true,
  });

  const uploadedFile = response.data;

  if (!uploadedFile.id || !uploadedFile.name) {
    throw new Error('Uploaded file is missing id or name');
  }

  return {
    id: uploadedFile.id,
    name: uploadedFile.name,
  };
}
