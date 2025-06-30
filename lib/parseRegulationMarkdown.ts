import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

config();

export type RegulationSection = {
  section: string;
  title: string;
  definitions: { term: string; definition: string }[];
  requirements: string[];
};

export async function parseRegulationMarkdown(
  filePath: string
): Promise<RegulationSection[]> {
  if (!filePath.endsWith('.md')) {
    throw new Error('Only markdown (.md) files are supported');
  }

  const markdown = fs.readFileSync(filePath, 'utf-8');

  const sectionBlocks = markdown
    .split(/^#### /gm)
    .filter((block) => block.trim().startsWith('§'));

  const parsedSections: RegulationSection[] = [];

  for (const block of sectionBlocks) {
    const [firstLine, ...rest] = block.trim().split('\n');
    const title = firstLine.trim();
    const content = rest.join('\n').trim();
    const section = title.match(/§\s*\d+(\.\d+)?/)?.[0] ?? '§ unknown';

    console.log(`🧠 Parsing ${section} - ${title}`);

    const prompt = `
        You are a compliance assistant analyzing a section from the Code of Federal Regulations.

        Please extract:
        - A list of definitions (as term + definition objects)
        - A list of concise one-sentence requirements that apply to companies or regulated entities

        Return a valid JSON object in this format:
        {
        "section": "${section}",
        "title": "${title}",
        "definitions": [
            { "term": "term name", "definition": "what it means" }
        ],
        "requirements": [
            "first requirement as a sentence",
            "second requirement..."
        ]
        }

        Only return the JSON. Do not include explanations or notes.

        Section Text:
        ${content}
    `.trim();

    try {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        prompt,
      });

      const cleaned = text
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
      const result: RegulationSection = JSON.parse(cleaned);
      parsedSections.push(result);
    } catch (err) {
      console.warn(`⚠️ Failed to parse section ${section}:`, err);
      parsedSections.push({
        section,
        title,
        definitions: [],
        requirements: [],
      });
    }
  }

  return parsedSections;
}

/**
 * Optional helper to write parsed output to disk for inspection
 */
export function saveParsedRegulationJson(
  sections: RegulationSection[],
  originalFilePath: string
) {
  const base = path.basename(originalFilePath, '.md');
  const outputPath = path.join('output', `${base}-llm.json`);
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ sections }, null, 2));
  console.log(`✅ Saved parsed JSON to ${outputPath}`);
}
