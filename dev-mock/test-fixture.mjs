import { createServer } from './server.mjs';
import { seed } from './domain.mjs';
import { scryptSync } from 'node:crypto';
export const TEST_PASSWORD = 'Synthetic fixture password 42!';
export const testEmail = role => ({admin:'lgu@example.test',citizen:'citizen@example.test',maintenance:'crew@example.test'})[role];
export function createTestServer(options = {}) {
 const data = seed(), salt = 'isolated-test-fixture';
 const hash = scryptSync(TEST_PASSWORD, salt, 64).toString('hex');
 for (const user of data.users) Object.assign(user, {salt,hash});
 return createServer({ ...options, persist:false, data });
}
