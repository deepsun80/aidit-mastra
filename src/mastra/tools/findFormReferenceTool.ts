/**
 * 🔎 findFormReferenceTool.ts
 *
 * 📄 Purpose:
 *   Given a form-related query, searches for references to relevant forms inside procedure (SP) documents.
 *   This helps the agent locate the correct form title or doc number when it’s not directly mentioned.
 *
 * 📥 Input:
 *   - query: string (e.g., "Is the supplier evaluation form reviewed by the Quality Manager?")
 *   - procedureCode: string (e.g., "SP") — used to filter the document set
 *   - topK: number — how many chunks to retrieve
 *
 * 📤 Output:
 *   - Array of { text, metadata } chunks from SP docs likely referencing the form
 *
 * ✅ Used when the query implies a form, but the form title/ID needs discovery from a procedure document
 */

import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeIndex } from '@lib/pineconeClient';
import { getOrgNamespace } from '@lib/helpers';
import z from 'zod';

const inputSchema = z.object({
  query: z.string().describe('User query that implies a form'),
  procedureCode: z.string().describe('Document code for procedures (e.g., SP)'),
  topK: z.number().default(30).describe('Top K results to return'),
  organization: z.string().describe('Organization to determine namespace'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const findFormReferenceTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'findFormReferenceTool',
  description:
    'Searches procedure documents for references to forms that match the query context',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { query, procedureCode, topK, organization } = context;

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const namespace = getOrgNamespace(organization);

    const results = await pineconeIndex.namespace(namespace).query({
      topK,
      vector: embedding,
      filter: {
        docCode: { $eq: procedureCode },
      },
      includeMetadata: true,
    });

    console.log('findFormReferenceTool raw matches:', results);

    return results.matches
      .filter((match) => match.score && match.score > 0.3)
      .flatMap((match) => {
        const fullText = String(match.metadata?.text ?? '');
        const formRefs = Array.from(
          fullText.matchAll(/\b(FM[-\s]?\d{2,5})([:\-]?\s*)([^\n|\.]{5,100})/gi)
        );

        if (formRefs.length === 0) {
          // No specific form match found, still include full chunk
          return [
            {
              text: fullText,
              metadata: match.metadata ?? {},
            },
          ];
        }

        // Else: include full context, but annotate the found match
        return formRefs.map(([, formNumber, , title]) => ({
          text: fullText,
          metadata: {
            ...match.metadata,
            formLabel: `${formNumber.toUpperCase()}: ${title.trim()}`,
          },
        }));
      });
  },
});
