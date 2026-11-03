import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.ts';
import { sha256 } from '../src/passwords.ts';
for (const allowDemo of [false, true]) {
 test(`demo access is removed even with allowDemo=${allowDemo}`, async () => {
  const { call, login, store, close } = await startServer({allowDemo});
  try {
   for (const path of ['/auth/demo','/auth/demo/accounts']) {
    for (const method of ['GET','POST','PUT','PATCH','DELETE']) {
     const result = await call(path, method === 'GET' ? undefined : {role:'admin'}, undefined, method);
     assert.equal(result.status,404);
     assert.equal(result.data.token,undefined);
    }
   }
   const valid = await login('admin');
   assert.equal(valid.status,200);
   assert.equal((await call('/bootstrap',undefined,valid.data.token)).status,200);
   await store.createSession(sha256('legacy-passwordless-token'),'admin-1',new Date(Date.now()+60000));
   assert.equal((await call('/bootstrap',undefined,'legacy-passwordless-token')).status,401);
   assert.equal((await call('/bootstrap',undefined,'account:legacy-passwordless-token')).status,401);
   const user = await store.userById('admin-1');
   await store.updateUser({...user!,passwordHash:null});
   await store.createSession(sha256('account:old-demo-token'),'admin-1',new Date(Date.now()+60000));
   assert.equal((await call('/bootstrap',undefined,'account:old-demo-token')).status,401);
   assert.equal((await call('/bootstrap',undefined,valid.data.token)).status,401);
   await store.updateUser(user!);
   assert.equal((await call('/bootstrap',undefined,'account:old-demo-token')).status,401);
   const fresh = await login('admin');
   assert.equal(fresh.status,200);
   assert.equal((await call('/bootstrap',undefined,fresh.data.token)).status,200);
  } finally {await close();}
 });
}
