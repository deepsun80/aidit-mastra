/**
 * 🧭 docCodeMapperTool.ts
 *
 * 📄 Purpose:
 *   Resolves organization-specific document code mappings for the AI agent.
 *   These codes tell the agent which metadata values to use for docCode
 *   when filtering quality manuals, procedures, and forms.
 *
 * 📥 Input:
 *   - organization: string (e.g., "paramount", "beyond-precision")
 *
 * 📤 Output:
 *   - { qualityManualCode: string, procedureCode: string, formCode: string }
 *
 * ✅ Used before calling query tools like queryByDocTypeTool or queryByTitleTool
 */

import { createTool } from '@mastra/core/tools';
import z from 'zod';

const inputSchema = z.object({
  organization: z.string().describe('Client organization name'),
});

const outputSchema = z.object({
  qualityManualCode: z.string(),
  procedureCode: z.string(),
  formCode: z.string(),
});

export const docCodeMapperTool = createTool<
  typeof inputSchema,
  typeof outputSchema
>({
  id: 'docCodeMapperTool',
  description:
    'Maps organization name to document code standards used in metadata',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { organization } = context;

    switch (organization.toLowerCase()) {
      case 'paramount':
        return {
          qualityManualCode: 'QM',
          procedureCode: 'SP',
          formCode: 'FM',
        };
      default:
        return {
          qualityManualCode: 'QM',
          procedureCode: 'SOP',
          formCode: 'FM',
        };
    }
  },
});
