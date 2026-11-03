// Read-only compatibility diagnosis: never calls migrate or changes the registry.
import { createPool } from '../src/config.ts';
import { checkMigrations, pgDb } from '../src/db.ts';

const db = pgDb(createPool());
try {
  await db.tx(async t => {
    await t.exec('set transaction read only');
    const { files, done } = await checkMigrations(t);
    console.log(`Recognized migration lineage. Pending: ${files.filter(f => !done.has(f)).join(', ') || 'none'}. Schema/data compatibility still requires acceptance testing.`);
  });
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
