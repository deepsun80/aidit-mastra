/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { Mistral } from '@mistralai/mistralai';

dotenv.config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

const client = new Mistral({
  apiKey: MISTRAL_API_KEY,
});

/**
 * Performs OCR on a local PDF using Mistral's file upload + vision OCR flow.
 */
export async function mistralOcrFromFile(filePath: string): Promise<string> {
  const fileName = path.basename(filePath);
  console.log(`📤 Uploading file to Mistral: ${fileName}`);

  try {
    // 1. Upload the file to Mistral
    const uploadedFile = fs.readFileSync(filePath);
    const uploadedPdf = await client.files.upload({
      file: {
        fileName,
        content: uploadedFile,
      },
      purpose: 'ocr',
    });

    if (!uploadedPdf.id) {
      throw new Error('Upload failed: No file ID returned');
    }

    // 2. Get a signed URL
    const { url } = await client.files.getSignedUrl({ fileId: uploadedPdf.id });

    if (!url) {
      throw new Error('Failed to retrieve signed URL from Mistral');
    }

    console.log(`🔗 Signed URL received: ${url}`);

    // 3. Process OCR
    const ocrResponse = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: url,
      },
      includeImageBase64: false,
      imageLimit: 0,
    });

    // Combine and clean up OCR page content
    const parsedText = ocrResponse.pages
      ?.map((page: any) => {
        const lines = (page.markdown || '').split('\n');

        return lines
          .map((line: string) => {
            if (line.trim().startsWith('|') && line.includes('|')) {
              const cells = line
                .split('|')
                .map((cell) => cell.trim())
                .filter((c) => c !== '');
              const pairs: string[] = [];
              for (let i = 0; i < cells.length; i += 2) {
                const key = cells[i];
                const value = cells[i + 1] ?? '';
                if (key || value) {
                  pairs.push(`${key}: ${value}`);
                }
              }
              return pairs.join('\n');
            }
            return line;
          })
          .join('\n');
      })
      .join('\n\n')
      .trim();

    console.log('🧠 Mistral OCR result (preview):\n', parsedText.slice(0, 500));
    return parsedText;
  } catch (error: any) {
    console.error('❌ Mistral OCR failed:', error);
    throw new Error('Failed to parse OCR from Mistral');
  }
}
