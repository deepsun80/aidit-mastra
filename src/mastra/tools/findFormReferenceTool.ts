import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { pineconeIndex } from '@lib/pineconeClient';
import { rerank } from '@mastra/rag';
import z from 'zod';

const inputSchema = z.object({
  query: z.string().describe('User query that implies a form'),
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
    const { query, organization } = context;

    const { embedding } = await embed({
      value: query,
      model: openai.embedding('text-embedding-3-small'),
    });

    const namespace = `${organization}__forms`;
    const topK = 30;

    const results = await pineconeIndex.namespace(namespace).query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    // ✅ Convert to QueryResult[] for rerank
    const rawChunks = results.matches.map((match, i) => ({
      id: match.id,
      text: String(match.metadata?.text ?? ''),
      metadata: match.metadata ?? {},
      score: match.score ?? 0.3,
    }));

    // 🧠 Rerank the Pinecone matches
    const reranked = await rerank(rawChunks, query, openai('gpt-4o'), {
      weights: {
        semantic: 0.5,
        vector: 0.3,
        position: 0.2,
      },
      topK,
    });

    return reranked.flatMap(({ result }) => {
      const fullText = String(result.metadata?.text ?? '');
      const formRefs = Array.from(
        fullText.matchAll(/\b(FM[-\s]?\d{2,5})([:\-]?\s*)([^\n|\.]{5,100})/gi)
      );

      if (formRefs.length === 0) {
        return [
          {
            text: fullText,
            metadata: result.metadata ?? {},
          },
        ];
      }

      return formRefs.map(([, formNumber, , title]) => ({
        text: fullText,
        metadata: {
          ...result.metadata,
          formLabel: `${formNumber.toUpperCase()}: ${title.trim()}`,
        },
      }));
    });
  },
});
