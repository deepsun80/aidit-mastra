/**
 * 📄 retrieveProcedureChunksTool
 *
 * Purpose:
 * Retrieves relevant document chunks from the "quality-manuals-and-procedures" namespace
 * based on a user's audit-related query (e.g., asking about policies, training, etc.).
 *
 * Usage:
 * Used when the question relates to quality manuals or procedures (e.g., SOPs, SPs).
 *
 * Parameters:
 * - query: the user’s question
 * - organization: used to construct the Pinecone namespace
 *
 * Returns:
 * - An array of relevant chunks `{ text, metadata }` from the document corpus
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { pineconeIndex } from '@lib/pineconeClient';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { rerank } from '@mastra/rag';

const inputSchema = z.object({
  query: z.string().describe("The user's audit-related question"),
  organization: z.string().describe('The client organization name'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const retrieveProcedureChunksTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'retrieveProcedureChunksTool',
  description:
    'Retrieves relevant document chunks from the quality manual and procedures namespace based on a user query.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, organization } = context;

    const namespace = `${organization}__quality-manuals-and-procedures`;
    const topK = 30;

    const { embeddings } = await embedMany({
      values: [query],
      model: openai.embedding('text-embedding-3-small'),
    });

    const embedding = embeddings[0];

    const results = await pineconeIndex.namespace(namespace).query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    console.log('results', results);

    const rawChunks =
      results.matches?.map((match, idx) => ({
        id: match.id ?? `match-${idx}`,
        text: String(match.metadata?.text ?? ''),
        score: match.score ?? 0,
        metadata: match.metadata ?? {},
      })) ?? [];

    // 🧠 Rerank
    const reranked = await rerank(rawChunks, query, openai('gpt-4o-mini'), {
      weights: {
        semantic: 0.5,
        vector: 0.3,
        position: 0.2,
      },
      topK: 10,
    });

    return reranked.map((item) => ({
      text: String(item.result.metadata?.text ?? ''),
      metadata: item.result.metadata ?? {},
    }));
  },
});
