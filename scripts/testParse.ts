import { parseDriveFilesToText } from '@lib/parseDriveFilesToText';

async function run() {
  const parsed = await parseDriveFilesToText();
  for (const file of parsed) {
    console.log(`\n📄 ${file.name}\n---\n${file.content.slice(0, 300)}...\n`);
  }
}

run();
