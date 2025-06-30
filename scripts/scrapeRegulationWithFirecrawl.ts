// scripts/scrapeRegulationMarkdown.ts
import { config } from 'dotenv';
import FirecrawlApp from '@mendable/firecrawl-js';
import fs from 'fs';
import path from 'path';

config();

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});

async function run() {
  const url = process.argv[2];
  if (!url) {
    console.error(
      '❌ Missing URL argument. Usage: npx tsx scripts/scrapeRegulationMarkdown.ts <URL>'
    );
    process.exit(1);
  }

  console.log(`🌐 Scraping Markdown for: ${url}`);

  const scrapeResult = await app.scrapeUrl(url, {
    formats: ['markdown'],
    waitFor: 2000,
  });

  if (!scrapeResult.success) {
    throw new Error(`❌ Firecrawl failed: ${scrapeResult.error}`);
  }

  const markdown = scrapeResult.markdown;
  if (!markdown) {
    throw new Error('❌ No markdown content returned');
  }

  const rawTitle =
    scrapeResult.metadata?.['ogTitle'] ??
    scrapeResult.metadata?.['dcterms.title'] ??
    '21-CFR-Part-unknown';

  const normalized = rawTitle
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .toLowerCase();

  const outputPath = path.join('output', `${normalized}.md`);
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(outputPath, markdown);
  console.log(`✅ Markdown saved to: ${outputPath}`);
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
