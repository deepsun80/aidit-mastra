/**
 * 🛠 formatAuditAnswerTool
 *
 * Purpose:
 * Formats a list of document chunks (retrieved from Pinecone or similar) into a concise,
 * auditor-friendly answer. It uses the LLM to:
 *   - Summarize content into a short 1–2 sentence answer
 *   - Determine if the answer is fully found in the provided context
 *   - Optionally cite document + page
 *   - Return a structured JSON with answer + `foundInContext` boolean
 *
 * Use case:
 * After a semantic document search retrieves matching text chunks,
 * this tool formats the final answer for the audit UI or report.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai'; // V3+ AI SDK

// 🧾 Define the expected input shape
const inputSchema = z.object({
  query: z.string().describe("The user's audit-related question"),
  docType: z
    .enum(['quality manual', 'procedure', 'form', 'general'])
    .describe('Type of document the answer came from'),
  chunks: z
    .array(
      z.object({
        text: z.string(),
        metadata: z.record(z.any()),
      })
    )
    .describe('Chunks retrieved from the relevant document(s)'),
});

// ✅ Define the expected output shape
const outputSchema = z.object({
  answer: z.string(),
  foundInContext: z.boolean(),
});

export const formatAuditAnswerTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'formatAuditAnswerTool',
  description:
    'Formats retrieved document chunks into a concise answer with citation and found-in-context flag. ' +
    'Each chunk must include both "text" and "metadata". ' +
    'Example input:\n' +
    '{ query: "Does the Quality Manual have a policy?", docType: "quality manual", chunks: [ { text: "The policy is...", metadata: { title: "Quality Manual", page: 1 } } ] }',
  inputSchema,
  outputSchema,

  // 🧠 Main logic to call LLM and parse its response
  execute: async ({ context }) => {
    const { query, docType, chunks } = context;

    // 🔍 Turn the document chunks into a readable prompt format
    const contextStr = chunks
      .map((chunk, i) => `Chunk ${i + 1}:\n${chunk.text}\n`)
      .join('\n\n');

    // 🧠 System prompt tells the LLM how to behave
    const systemPrompt = `
        You are an assistant that summarizes audit-related content from medical device documentation.

        Context type: ${docType}
        User question: "${query}"

        Your task:
        - Read the provided document chunks.
        - Extract and return a clear, concise answer (1–2 sentences), and avoid adding extra information..
        - Prioritize direct answers (Yes or No) when possible.
        - If the document mentions another document (such as SP108 or FM112), clearly indicate the referenced document ID.
        - If the answer is clearly found in the chunks, return: foundInContext = true.
        - If only partial or related info is found, still answer but set foundInContext = false.
        - If nothing relevant is found, say: "The ${docType} does not contain this information." and set foundInContext = false.
        - Always include a citation in the format:
            Cited from: Document Name

        Provide your result as a strict JSON object:
        {
        "answer": "...",
        "foundInContext": true | false
        }
    `.trim();

    const userPrompt = `Document Chunks:\n${contextStr}`;

    // 💬 Run the chat model with system + user message
    const result = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: userPrompt,
    });

    const rawText = result.text.trim();

    // 🧪 Try to extract the JSON from the model response
    const match = rawText.match(
      /({\s*"answer"\s*:\s*".+?",\s*"foundInContext"\s*:\s*(true|false)\s*})/s
    );

    try {
      return match
        ? JSON.parse(match[1])
        : { answer: rawText, foundInContext: false };
    } catch {
      return {
        answer: rawText || 'No response.',
        foundInContext: false,
      };
    }
  },
});
