import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeRegulationIndex } from '@lib/pineconeClient';

const inputSchema = z.object({
  query: z.string().describe('The user’s regulatory question'),
  standard: z
    .string()
    .describe('The standardization namespace to search (e.g., "cfr", "iso")'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const queryRegulationTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'queryRegulationTool',
  description:
    'Searches regulatory standards like 21 CFR or ISO for relevant definitions and requirements based on a user query.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, standard } = context;

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const topK = 20;

    const results = await pineconeRegulationIndex.namespace(standard).query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    const chunks =
      results.matches.map((match) => ({
        text: String(match.metadata?.text ?? ''),
        metadata: match.metadata ?? {},
      })) || [];

    return chunks;
  },
});
