import { parseDriveFilesWithMetadata } from '@lib/parseWithMetadata';

async function run() {
  const parsedDocs = await parseDriveFilesWithMetadata();
  for (const doc of parsedDocs) {
    console.log(`\n📄 ${doc.fileName}`);
    console.log(`Metadata:`, doc.metadata);
    console.log(`Text sample:\n${doc.text.slice(0, 300)}...\n`);
  }
}

run();
