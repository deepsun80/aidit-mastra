import fs from 'fs';
import os from 'os';
import path from 'path';
import { fetchGoogleDriveFiles, downloadFileContent } from '@lib/googleDrive';
import { mistralOcrFromFile } from '@lib/mistralOcr';

type ParsedFile = {
  name: string;
  content: string;
};

export async function parseDriveFilesToText(): Promise<ParsedFile[]> {
  console.log('📂 Fetching files from Google Drive...');

  const files = await fetchGoogleDriveFiles();
  const targetFiles = files.filter((f) => f.name?.match(/\.(pdf|docx)$/i));

  const parsedFiles: ParsedFile[] = [];

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

      const parsedText = await mistralOcrFromFile(tempPath);

      parsedFiles.push({
        name: file.name,
        content: parsedText,
      });

      console.log(`✅ Parsed ${file.name} (${parsedText.length} chars)`);

      fs.unlinkSync(tempPath);
    } catch (err) {
      console.error(`❌ Failed to parse ${file.name}:`, err);
    }
  }

  console.log(`\n🎉 Done. Parsed ${parsedFiles.length} files.`);
  return parsedFiles;
}
