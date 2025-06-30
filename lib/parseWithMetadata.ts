import fs from 'fs';
import os from 'os';
import path from 'path';
import { fetchGoogleDriveFiles, downloadFileContent } from '@lib/googleDrive';
import { mistralOcrFromFile, OCRPage } from '@lib/mistralOcr';

/**
 * 🧱 Structure representing a parsed document with attached metadata
 */
export type ParsedFileWithMetadata = {
  fileName: string;
  text: string;
  metadata: {
    docCode: string;
    docNumber: string;
    docVersion: string;
    title: string;
    page: number;
  };
};

/**
 * 🧠 Extracts metadata (docCode, docNumber, docVersion, title) from a file name.
 */
function extractMetadataFromFilename(
  name: string
): Omit<ParsedFileWithMetadata['metadata'], 'page'> {
  const baseName = name.replace(/\.(docx|pdf)$/i, '');

  // 🔍 Look for document type + number
  const fmMatch = baseName.match(/\bFM[- ]?(\d{2,5})\b/i);
  const docMatch = baseName.match(/\b(QM|SP|SOP)[- ]?(\d{2,5})\b/i);
  const versionMatch = baseName.match(/\bREV[- ]?(\d{1,3})\b/i);

  // 🧭 Priority: FM > SP/SOP > QM
  const docCode = fmMatch?.[0]?.startsWith('FM')
    ? 'FM'
    : (docMatch?.[1]?.toUpperCase() ?? 'unknown');

  const docNumber = fmMatch?.[1] ?? docMatch?.[2] ?? 'unknown';

  const docVersion = versionMatch?.[1] ? `REV ${versionMatch[1]}` : '';

  // 🏷️ Extract title from the portion after number but before -REV or (
  const titleMatch = baseName.match(/(?:\d{2,5})[- ]+(.*?)(?:-REV|\(|$)/i);
  const title = titleMatch?.[1]?.trim().replace(/[_-]/g, ' ') ?? 'Untitled';

  return {
    docCode,
    docNumber,
    docVersion,
    title,
  };
}

/**
 * 📂 Downloads and parses documents from a specific Google Drive folder,
 * 🧠 extracts metadata,
 * 🧾 and returns an array of structured text + metadata.
 *
 * 📥 Input:
 *   - folderId: Google Drive folder ID to fetch files from
 */
export async function parseDriveFilesWithMetadata(
  folderId: string
): Promise<ParsedFileWithMetadata[]> {
  console.log(`📂 Fetching files from Google Drive folder: ${folderId}...`);

  const files = await fetchGoogleDriveFiles(folderId);
  const targetFiles = files.filter((f) => f.name?.match(/\.(pdf|docx)$/i));

  const parsedFiles: ParsedFileWithMetadata[] = [];

  for (const file of targetFiles) {
    if (!file.id || !file.name) continue;

    const safeFileName = file.name.replace(/\s+/g, '_');
    const tempPath = path.join(os.tmpdir(), safeFileName);

    console.log(`\n📄 Processing: ${file.name}`);

    try {
      const fileBuffer = await downloadFileContent(file.id);
      if (!fileBuffer) {
        console.warn(`⚠️ Skipping empty file: ${file.name}`);
        continue;
      }

      fs.writeFileSync(tempPath, fileBuffer);

      // 🤖 Run OCR using Mistral
      const pages: OCRPage[] = await mistralOcrFromFile(tempPath);

      // 🏷️ Extract metadata from filename
      const baseMetadata = extractMetadataFromFilename(file.name);

      // 📦 Collect parsed document data for each page
      for (const page of pages) {
        parsedFiles.push({
          fileName: file.name,
          text: page.text,
          metadata: {
            ...baseMetadata,
            page: page.page,
          },
        });
      }

      console.log(`✅ Parsed ${file.name} →`, baseMetadata);
      fs.unlinkSync(tempPath);
    } catch (err) {
      console.error(`❌ Failed to parse ${file.name}:`, err);
    }
  }

  console.log(`\n🎉 Done. Parsed ${parsedFiles.length} files.`);
  return parsedFiles;
}
