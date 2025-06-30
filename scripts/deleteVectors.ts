import dotenv from 'dotenv';
import { pineconeIndex } from '@lib/pineconeClient';

dotenv.config({ path: '.env.local' });

// Add known namespaces here or load them dynamically from config
const namespaces = [
  'paramount__quality-manuals-and-procedures',
  'paramount__forms',
];

async function deleteAllVectors() {
  for (const ns of namespaces) {
    console.log(`🧹 Deleting all vectors in namespace: ${ns}...`);
    try {
      await pineconeIndex.namespace(ns).deleteAll();
      console.log(`✅ Deleted all vectors from namespace: ${ns}`);
    } catch (err) {
      console.error(`❌ Failed to delete namespace: ${ns}`, err);
    }
  }
}

deleteAllVectors().catch((err) => {
  console.error('❌ Error running deletion script:', err);
  process.exit(1);
});
