/**
 * 📄 queryFormByCodeTool.ts
 *
 * 🧠 Purpose:
 *   Retrieves the content of a specific form (e.g., FM803) using its docCode and docNumber,
 *   which were either extracted from the query or inferred using another tool.
 *
 * 📥 Input:
 *   - docCode: string (e.g., "FM")
 *   - docNumber: string (e.g., "803")
 *
 * 📤 Output:
 *   - Array of chunks from the matching form document
 *
 * ✅ Used when a specific form is identified and needs to be queried directly.
 */

import { createTool } from '@mastra/core/tools';
import { pineconeIndex } from '@lib/pineconeClient';
import { getOrgNamespace } from '@lib/helpers';
import z from 'zod';

const inputSchema = z.object({
  docCode: z.string().describe('Document code for form (e.g., FM)'),
  docNumber: z.string().describe('Document number (e.g., 803)'),
  organization: z.string().describe('Organization to determine namespace'),
});

const outputSchema = z.array(
  z.object({
    text: z.string(),
    metadata: z.record(z.any()),
  })
);

export const queryFormByCodeTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'queryFormByCodeTool',
  description: 'Retrieves a specific form document using its code and number',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { docCode, docNumber, organization } = context;

    const namespace = getOrgNamespace(organization);

    const results = await pineconeIndex.namespace(namespace).query({
      topK: 10,
      vector: new Array(1536).fill(0), // Dummy vector since we’re just filtering by metadata
      filter: {
        docCode: { $eq: docCode },
        docNumber: { $eq: docNumber },
      },
      includeMetadata: true,
    });

    return results.matches.map((match) => ({
      text: String(match.metadata?.text ?? ''),
      metadata: match.metadata ?? {},
    }));
  },
});
