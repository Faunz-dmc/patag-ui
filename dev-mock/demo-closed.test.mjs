import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestServer,TEST_PASSWORD,testEmail} from './test-fixture.mjs';
test('mock demo endpoints stay closed even with legacy enable flag',async()=>{
 const server=await createTestServer({allowDemo:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  for(const role of ['admin','maintenance','citizen'])for(const path of ['/auth/demo','/auth/demo/accounts']) for(const method of ['GET','POST','PUT','PATCH','DELETE']) {
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api`+path,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify({role})})});
   assert.equal(response.status,404);assert.equal((await response.json()).token,undefined);
  }
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'admin',email:testEmail('admin'),password:TEST_PASSWORD})});
  assert.equal(response.status,200);assert.ok((await response.json()).token);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
