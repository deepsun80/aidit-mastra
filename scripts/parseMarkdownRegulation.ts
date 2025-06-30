import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

config();

type StructuredSection = {
  section: string;
  title: string;
  definitions: { term: string; definition: string }[];
  requirements: string[];
};

async function parseSectionWithLLM(
  section: string,
  title: string,
  content: string
): Promise<StructuredSection> {
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
    `;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt,
  });

  try {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```$/, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn(`⚠️ Failed to parse JSON for ${section}:`, err);
    return {
      section,
      title,
      definitions: [],
      requirements: [],
    };
  }
}

async function run() {
  const inputFile = process.argv[2];
  if (!inputFile || !inputFile.endsWith('.md')) {
    console.error(
      '❌ Provide a Markdown file path (e.g. output/21-cfr-part-803.md)'
    );
    process.exit(1);
  }

  const markdown = fs.readFileSync(inputFile, 'utf-8');

  const sectionBlocks = markdown
    .split(/^#### /gm)
    .filter((block) => block.trim().startsWith('§'));

  const results: StructuredSection[] = [];

  for (const block of sectionBlocks) {
    const [firstLine, ...rest] = block.trim().split('\n');
    const title = firstLine.trim();
    const content = rest.join('\n').trim();
    const section = title.match(/§\s*\d+(\.\d+)?/)?.[0] ?? '§ unknown';

    console.log(`🔍 Processing ${section} - ${title}`);
    const parsed = await parseSectionWithLLM(section, title, content);
    results.push(parsed);
  }

  const base = path.basename(inputFile, '.md');
  const outputPath = path.join('output', `${base}-llm.json`);
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ sections: results }, null, 2));
  console.log(`✅ Structured JSON with LLM saved to: ${outputPath}`);
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
