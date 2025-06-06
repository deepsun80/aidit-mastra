import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { parseDriveFilesWithMetadata } from '@lib/parseWithMetadata';
import { pineconeIndex } from '@lib/pineconeClient';
import dotenv from 'dotenv';

dotenv.config();

type Vector = {
  id: string;
  values: number[];
  metadata: Record<string, any>;
};

function chunkText(text: string, chunkSize = 512, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

export async function indexDocuments() {
  console.log('📄 Parsing files with metadata...');
  const parsedDocs = await parseDriveFilesWithMetadata();

  const vectors: Vector[] = [];

  for (const doc of parsedDocs) {
    const { text, fileName, metadata } = doc;
    const chunks = chunkText(text);

    console.log(`✂️ ${fileName} → ${chunks.length} chunks`);

    const chunkMetas = chunks.map((chunkText, idx) => ({
      text: chunkText,
      chunk_index: idx,
      file_name: fileName,
      ...metadata,
    }));

    const { embeddings } = await embedMany({
      values: chunks,
      model: openai.embedding('text-embedding-3-small'),
    });

    embeddings.forEach((embedding, i) => {
      vectors.push({
        id: `${fileName}-${i}`,
        values: embedding,
        metadata: chunkMetas[i],
      });
    });
  }

  if (vectors.length === 0) {
    console.warn('⚠️ No vectors to upsert.');
    return;
  }

  const orgNamespace =
    process.argv[2] || process.env.PINECONE_NAMESPACE || 'default';
  console.log(`📡 Upserting ${vectors.length} vectors to Pinecone...`);

  await pineconeIndex.namespace(orgNamespace).upsert(vectors);

  console.log('✅ Indexing complete.');
}
