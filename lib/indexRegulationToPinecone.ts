import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { RegulationSection } from './parseRegulationMarkdown';
import { pineconeRegulationIndex } from './pineconeClient';

type Vector = {
  id: string;
  values: number[];
  metadata: Record<string, any>;
};

function normalizeId(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9\-]/gi, '-') // replace non-alphanumeric
    .replace(/-+/g, '-') // collapse repeated dashes
    .replace(/(^-|-$)/g, ''); // trim leading/trailing dashes
}

export async function indexRegulationToPinecone(
  sections: RegulationSection[],
  options: {
    regulationId: string; // e.g. "21 CFR Part 803"
    namespace: string; // e.g. "cfr"
  }
): Promise<void> {
  const vectors: Vector[] = [];

  for (const section of sections) {
    const { section: sectionId, title, definitions, requirements } = section;

    // Convert definitions
    for (const [i, def] of definitions.entries()) {
      const text = `Definition of "${def.term}": ${def.definition}`;
      vectors.push({
        id: normalizeId(options.regulationId, sectionId, 'def', String(i)),
        values: [], // placeholder — will be embedded below
        metadata: {
          type: 'definition',
          regulation: options.regulationId,
          section: sectionId,
          title,
          term: def.term,
          text,
        },
      });
    }

    // Convert requirements
    for (const [j, req] of requirements.entries()) {
      vectors.push({
        id: normalizeId(options.regulationId, sectionId, 'req', String(j)),
        values: [], // placeholder — will be embedded below
        metadata: {
          type: 'requirement',
          regulation: options.regulationId,
          section: sectionId,
          title,
          text: req,
        },
      });
    }
  }

  if (vectors.length === 0) {
    console.warn('⚠️ No vectors to index.');
    return;
  }

  console.log(`🔢 Embedding ${vectors.length} chunks...`);

  const { embeddings } = await embedMany({
    values: vectors.map((v) => v.metadata.text),
    model: openai.embedding('text-embedding-3-small'),
  });

  embeddings.forEach((embedding, i) => {
    vectors[i].values = embedding;
  });

  console.log(`📡 Upserting to Pinecone namespace: ${options.namespace}`);
  await pineconeRegulationIndex.namespace(options.namespace).upsert(vectors);

  console.log('✅ Indexing complete.');
}
