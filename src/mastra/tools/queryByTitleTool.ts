/**
 * 📄 queryByTitleTool
 *
 * Retrieves relevant document chunks from Pinecone based on:
 * - An audit-related query
 * - A specific `titleKeyword` that must be found in the document title
 * - A configurable number of topK matches (default: 10)
 *
 * This tool performs a semantic search using the embedded query and filters
 * results by title keyword (e.g., "supplier evaluation") in Pinecone metadata.
 *
 * 💡 Assumes the agent has already used `docCodeMapperTool` or a prior planning step
 * to determine what keyword best represents the target document title.
 *
 * Output: Array of { text, metadata } objects from matching document chunks.
 */

import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeIndex } from '@lib/pineconeClient';
import { getOrgNamespace } from '@lib/helpers';
import z from 'zod';

const inputSchema = z.object({
  query: z.string().describe("The user's audit-related question"),
  titleKeyword: z
    .string()
    .describe('A keyword or phrase to match the document title'),
  topK: z.number().default(30).describe('Number of top chunks to return'),
  organization: z.string().describe('Organization to determine namespace'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const queryByTitleTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'queryByTitleTool',
  description:
    'Retrieve document chunks from files whose titles match a given keyword and are semantically relevant to the query.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, titleKeyword, topK, organization } = context;

    // Step 1: Embed the query
    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const namespace = getOrgNamespace(organization);

    // Step 2: Full semantic search (no metadata filter)
    const results = await pineconeIndex.namespace(namespace).query({
      topK: topK * 3, // Over-fetch to allow filtering
      vector: embedding,
      includeMetadata: true,
    });

    // Step 3: Filter matches by whether title or file_name includes the keyword
    const matches = results.matches
      .filter((match) => {
        const title = String(match.metadata?.title ?? '');
        const fileName = String(match.metadata?.file_name ?? '');
        const keyword = titleKeyword.toLowerCase();
        return (
          title.toLowerCase().includes(keyword) ||
          fileName.toLowerCase().includes(keyword)
        );
      })
      .slice(0, topK) // Limit to topK after filtering
      .map((match) => ({
        text: String(match.metadata?.text ?? ''),
        metadata: match.metadata ?? {},
      }));

    return matches;
  },
});
