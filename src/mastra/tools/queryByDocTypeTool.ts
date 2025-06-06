/**
 * 📄 queryByDocTypeTool
 *
 * Retrieves relevant document chunks from Pinecone based on:
 * - An audit-related query
 * - A specific `docCode` representing document type (e.g., "QM", "SP", "FM")
 * - A configurable number of topK matches (default: 10)
 *
 * This tool performs a semantic search using the embedded query and filters
 * results by the provided document code via Pinecone metadata.
 *
 * 💡 Assumes the agent has already used `docCodeMapperTool` to resolve organization-specific
 * document code mappings (e.g., "quality_manual" → "QM"). The mapped value should be
 * passed into this tool as the `docCode` input.
 *
 * Output: Array of { text, metadata } objects from matching document chunks.
 */

import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeIndex } from '@lib/pineconeClient';
import { getOrgNamespace } from '@lib/helpers';
import z from 'zod';

// ✅ Input and output schemas
const inputSchema = z.object({
  query: z.string().describe("The user's audit-related question"),
  docCode: z
    .string()
    .describe('Document code to filter by, such as QM, SP, or FM'),
  topK: z.number().default(30).describe('Number of top chunks to return'),
  organization: z.string().describe('Organization to determine namespace'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

// ✅ Pass generics explicitly: <input, output>
export const queryByDocTypeTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'queryByDocTypeTool',
  description:
    'Retrieve relevant document chunks based on query and document type',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, docCode, topK, organization } = context;

    console.log('Context: ', context);
    console.log('Organization:', organization);

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const namespace = getOrgNamespace(organization);

    const results = await pineconeIndex.namespace(namespace).query({
      topK,
      vector: embedding,
      filter: {
        docCode: { $eq: docCode },
      },
      includeMetadata: true,
    });

    console.log('All matches:', results.matches);

    return results.matches
      .filter((match) => match.score && match.score > 0.3)
      .map((match) => ({
        text: String(match.metadata?.text ?? ''),
        metadata: match.metadata ?? {},
      }));
  },
});
