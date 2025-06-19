import {
  parseRegulationMarkdown,
  saveParsedRegulationJson,
} from '@lib/parseRegulationMarkdown';
import { indexRegulationToPinecone } from '@lib/indexRegulationToPinecone';
import path from 'path';

async function run() {
  const inputFile = process.argv[2]; // e.g., output/21-cfr-part-803.md
  const regulationId = process.argv[3]; // e.g., "21 CFR Part 803"
  const namespace = process.argv[4]; // e.g., "cfr"

  if (!inputFile || !regulationId || !namespace) {
    console.error(
      '❌ Usage: npx tsx scripts/parseAndIndexRegulation.ts <markdown.md> <regulationId> <namespace>'
    );
    console.error(
      'e.g., npx tsx scripts/parseAndIndexRegulation.ts output/21-cfr-part-803.md "21 CFR Part 803" cfr'
    );
    process.exit(1);
  }

  console.log(`🔍 Parsing: ${regulationId} → Namespace: ${namespace}`);

  const sections = await parseRegulationMarkdown(inputFile);
  saveParsedRegulationJson(sections, inputFile);

  await indexRegulationToPinecone(sections, {
    regulationId,
    namespace,
  });

  console.log('🎉 Regulation fully processed and indexed.');
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
