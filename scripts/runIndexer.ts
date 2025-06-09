import { indexDocuments } from '@lib/indexDocuments';
import { getNamespace } from '@lib/helpers';
import { upsertTargets } from '../config/upsertTargets';

async function runAll() {
  for (const target of upsertTargets) {
    const { client, docType, folderId } = target;
    const namespace = getNamespace(client, docType);

    console.log(
      `🚀 Indexing ${docType} for ${client} → namespace: ${namespace}`
    );
    await indexDocuments({ folderId, namespace, client });
  }
}

runAll().catch((err) => {
  console.error('❌ Indexing failed:', err);
  process.exit(1);
});
