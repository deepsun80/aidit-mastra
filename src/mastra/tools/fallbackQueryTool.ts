/**
 * 🔄 fallbackQueryTool.ts
 *
 * 🧠 Purpose:
 *   As a last-resort strategy, this tool attempts to retrieve relevant content from documents
 *   tagged as Quality Manuals or Standard Procedures (docCode = "QM" or "SP").
 *   It uses vector similarity on the query alone with limited scope.
 *
 * 📥 Input:
 *   - query: string (the audit-related question)
 *   - topK: number (optional; defaults to 10)
 *   - organization: string (used to resolve namespace)
 *
 * 📤 Output:
 *   - Array of semantically matched chunks with metadata
 */

import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeIndex } from '@lib/pineconeClient';
import { getOrgNamespace } from '@lib/helpers';
import z from 'zod';

const inputSchema = z.object({
  query: z.string().describe('The user’s audit-related question'),
  topK: z.number().default(30).describe('Number of top chunks to return'),
  organization: z.string().describe('Organization to determine namespace'),
  qualityManualCode: z
    .string()
    .describe('Org-specific code for Quality Manuals'),
  procedureCode: z.string().describe('Org-specific code for Procedures'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const fallbackQueryTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'fallbackQueryTool',
  description:
    'Attempts semantic retrieval across Quality Manual and Procedure documents as a last resort.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, topK, organization, qualityManualCode, procedureCode } =
      context;

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const namespace = getOrgNamespace(organization);

    const results = await pineconeIndex.namespace(namespace).query({
      topK,
      vector: embedding,
      includeMetadata: true,
      filter: {
        docCode: { $in: [qualityManualCode, procedureCode] }, // ⬅️ Restrict to relevant high-level documents only
      },
    });

    return results.matches
      .filter((match) => match.score && match.score > 0.3)
      .map((match) => ({
        text: String(match.metadata?.text ?? ''),
        metadata: match.metadata ?? {},
      }));
  },
});
