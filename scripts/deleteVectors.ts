import dotenv from 'dotenv';
import { pineconeIndex } from '@lib/pineconeClient'; // uses your shared client setup

dotenv.config({ path: '.env.local' });

// Get namespace from CLI argument or .env fallback
const namespace =
  process.argv[2] || process.env.PINECONE_NAMESPACE || 'default';

async function deleteAllVectors() {
  console.log(`🧹 Deleting all vectors in namespace: ${namespace}...`);
  await pineconeIndex.namespace(namespace).deleteAll();
  console.log('✅ All vectors deleted from namespace:', namespace);
}

deleteAllVectors().catch((err) => {
  console.error('❌ Error deleting vectors:', err);
  process.exit(1);
});
