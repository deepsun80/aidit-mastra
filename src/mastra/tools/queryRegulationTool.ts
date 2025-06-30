import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { rerank } from '@mastra/rag';
import { pineconeRegulationIndex } from '@lib/pineconeClient';

const inputSchema = z.object({
  query: z.string().describe('The user’s regulatory question'),
  standard: z
    .string()
    .describe('The standardization namespace to search (e.g., "cfr", "iso")'),
  type: z
    .enum(['definition', 'requirement'])
    .describe('The type of information to look for in regulation'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

function extractRegulationId(query: string): string | null {
  const match = query.match(/21\s*CFR\s*(Part\s*)?(\d{3})/i);
  if (match) {
    return `21 CFR Part ${match[2]}`;
  }
  const isoMatch = query.match(/ISO\s*(\d{4,5})/i);
  if (isoMatch) {
    return `ISO ${isoMatch[1]}`;
  }
  return null;
}

export const queryRegulationTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'queryRegulationTool',
  description:
    'Searches regulatory standards for relevant definitions or requirements based on the user query and regulation context.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, standard, type } = context;

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const topK = 30;

    const regulationId = extractRegulationId(query);
    if (!regulationId) {
      return [];
    }

    const results = await pineconeRegulationIndex.namespace(standard).query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: {
        type: { $eq: type },
        regulation: { $eq: regulationId },
      },
    });

    // 🔍 rawChunks for reranking
    const rawChunks =
      results.matches.map((match, i) => ({
        id: match.id ?? `match-${i}`,
        text:
          type === 'definition'
            ? `Definition of "${match.metadata?.term}": ${match.metadata?.text ?? ''}`
            : String(match.metadata?.text ?? ''),
        metadata: match.metadata ?? {},
        score: match.score ?? 0.3,
      })) || [];

    // 🧠 rerank the matches
    const reranked = await rerank(rawChunks, query, openai('gpt-4o'), {
      weights: {
        semantic: 0.5,
        vector: 0.3,
        position: 0.2,
      },
      topK,
    });

    return reranked.map(({ result }) => ({
      text: String(result.metadata?.text ?? ''),
      metadata: result.metadata ?? {},
    }));
  },
});
