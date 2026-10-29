import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecoveryLink } from '../src/recovery.ts';
test('recovery callback accepts token-hash links and standard recovery fragments',()=>{
 assert.deepEqual(readRecoveryLink('?token_hash=test-hash&type=recovery',''),{tokenHash:'test-hash'});
 assert.deepEqual(readRecoveryLink('','#access_token=test-access-token&refresh_token=ignored&type=recovery'),{accessToken:'test-access-token'});
 assert.deepEqual(readRecoveryLink('?token_hash=legacy-hash',''),{tokenHash:'legacy-hash'});
});
test('recovery callback handles missing, expired, wrong-flow and ambiguous links without echoing tokens',()=>{
 for(const [search,hash] of [['',''],['','#error=access_denied&error_code=otp_expired&error_description=secret-value'],['','#access_token=secret-value&type=signup'],['?token_hash=secret-value&type=recovery','#access_token=another-secret&type=recovery']]){
  const result=readRecoveryLink(search,hash);assert.ok('error' in result);assert.ok(!result.error.includes('secret-value'));
 }
});
