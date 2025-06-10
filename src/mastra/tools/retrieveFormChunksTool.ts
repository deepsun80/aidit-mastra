/**
 * 📄 retrieveFormChunksTool
 *
 * Purpose:
 * Retrieves form chunks from the "forms" namespace in Pinecone using a metadata filter.
 * Designed for when the agent already knows the `docNumber` (e.g., "803") from a form code like "FM803".
 *
 * Use Case:
 * Called after extracting a referenced form number (e.g., FM803) to pull relevant content from form documents.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { pineconeIndex } from '@lib/pineconeClient';

const inputSchema = z.object({
  docNumber: z.string().describe('The form number to search, e.g., "803"'),
  organization: z
    .string()
    .describe('Organization name, lowercase, e.g., "paramount"'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const retrieveFormChunksTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'retrieveFormChunksTool',
  description:
    'Searches the forms namespace using a metadata filter (docNumber) and returns all matching chunks.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { docNumber, organization } = context;

    const namespace = `${organization}__forms`;
    const topK = 30;

    const results = await pineconeIndex.namespace(namespace).query({
      topK,
      vector: new Array(1536).fill(0), // Dummy vector since we’re just filtering by metadata
      filter: {
        docNumber: { $eq: docNumber },
      },
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
