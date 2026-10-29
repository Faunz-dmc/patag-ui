import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, claimsFor } from '../auth.mjs';
const config={url:'https://test.supabase.co',publicKey:'public-test-key',serviceKey:'private-test-key',secure:false};
const token=claims=>`header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
test('Auth rejects expired or mismatched tokens after server verification',()=>{
  const base={sub:'00000000-0000-4000-8000-000000000001',session_id:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+60,iss:config.url+'/auth/v1',aal:'aal1'};
  assert.equal(claimsFor(token(base),{id:base.sub},config).sub,base.sub);
  assert.throws(()=>claimsFor(token({...base,exp:1}),{id:base.sub},config),/expired/);
  assert.throws(()=>claimsFor(token(base),{id:'different'},config),/expired/);
});
test('Auth uses public key for password login and never returns upstream internals',async()=>{
  const auth=createAuth(config,async(url,options)=>{
    assert.ok(url.endsWith('/auth/v1/token?grant_type=password'));
    assert.equal(options.headers.apikey,'public-test-key');
    return new Response(JSON.stringify({error_description:'private SQL host details'}),{status:400});
  });
  await assert.rejects(auth.login('admin@patag.test','wrong'),e=>e.status===401&&!e.message.includes('SQL'));
  const unavailable=createAuth(config,async()=>{throw Error('network host details');});
  await assert.rejects(unavailable.login('a@b.test','password'),e=>e.status===503&&!e.message.includes('host'));
});

test('recovery uses the public Auth API and the verified user token for password updates',async()=>{
 const requests=[];
 const auth=createAuth(config,async(url,options)=>{requests.push({url,...options});return new Response(JSON.stringify(url.endsWith('/verify')?{access_token:'synthetic-recovery-token'}:{}));});
 assert.equal((await auth.verifyRecovery('synthetic-hash')).access_token,'synthetic-recovery-token');
 await auth.updatePassword('synthetic-recovery-token','synthetic new password');
 assert.deepEqual(JSON.parse(requests[0].body),{token_hash:'synthetic-hash',type:'recovery'});
 assert.equal(requests[0].headers.apikey,config.publicKey);assert.equal(requests[0].headers.Authorization,undefined);
 assert.equal(requests[1].method,'PUT');assert.equal(requests[1].headers.apikey,config.publicKey);assert.equal(requests[1].headers.Authorization,'Bearer synthetic-recovery-token');
 assert.deepEqual(JSON.parse(requests[1].body),{password:'synthetic new password'});
 const rejected=createAuth(config,async()=>new Response(JSON.stringify({error:'provider-secret'}),{status:401}));
 await assert.rejects(()=>rejected.verifyRecovery('expired'),error=>error.status===401&&!error.message.includes('provider-secret'));
 await assert.rejects(()=>rejected.updatePassword('expired','synthetic new password'),error=>error.status===400&&!error.message.includes('provider-secret'));
});
