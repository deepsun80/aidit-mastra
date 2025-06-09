/**
 * 🛠️ formatError
 *
 * Safely extracts a human-readable error message from an unknown error object.
 * If the error is a standard `Error` instance, it returns the `.message`.
 * Otherwise, it returns the provided fallback string.
 *
 * 📥 Input:
 *   - error: unknown (any caught error, may or may not be an Error object)
 *   - fallback: string (default message to use if error is not an Error)
 *
 * 📤 Output:
 *   - string: extracted message or fallback
 *
 * ✅ Used to normalize error logging and prevent crashes from unexpected error shapes.
 */
export function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * 🏷️ getOrgNamespace
 *
 * Converts an organization name into a Pinecone-compatible namespace string.
 * E.g., "Paramount Surgicals" → "paramount-surgicals"
 */
export function getOrgNamespace(org: string) {
  return org.toLowerCase().replace(/\s+/g, '-');
}

/**
 * 🧭 getNamespace
 *
 * Generates a Pinecone namespace string using client and document type.
 * Combines both values into a lowercase, dash-separated format to ensure consistency.
 *
 * Example:
 *   getNamespace("paramount", "quality-manuals and procedures")
 *   → "paramount__quality-manuals-and-procedures"
 *
 * 📥 Input:
 *   - client: string (e.g., "paramount")
 *   - docType: string (e.g., "quality-manuals and procedures")
 *
 * 📤 Output:
 *   - string: valid Pinecone namespace (e.g., "paramount__quality-manuals-and-procedures")
 *
 * ✅ Used to isolate document chunks by type within a single client index.
 */
export function getNamespace(client: string, docType: string): string {
  return `${client.toLowerCase()}__${docType.replace(/\s+/g, '-').toLowerCase()}`;
}
