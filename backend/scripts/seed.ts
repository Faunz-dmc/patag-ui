// Inserts the fictional demo data. Safe to re-run: existing rows are left alone.
import { createPool } from '../src/config.ts';
import { migrate, pgDb } from '../src/db.ts';
import { Store } from '../src/store.ts';
import { seedAll } from '../src/seed.ts';

const db = pgDb(createPool());
try {
  await migrate(db);
  await seedAll(new Store(db));
  console.log('Seeded fictional demo data. Seeded accounts cannot sign in until an administrator provisions a password.');
} finally {
  await db.close();
}
