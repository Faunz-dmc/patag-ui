import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDates, resolutionDays } from '../src/analytics.ts';
test('time charts keep complete dates across months and current records',()=>{
  assert.deepEqual(reportDates([{createdAt:'2026-11-10T00:00:00Z'},{createdAt:'2026-10-27T00:00:00Z'},{createdAt:'2026-10-10T00:00:00Z'}]),['2026-10-10','2026-10-27','2026-11-10']);
});
test('resolution duration ignores unrelated later actions',()=>{
  const report={createdAt:'2026-10-20T00:00:00Z',history:[{action:'resolve',to:'Resolved',at:'2026-10-22T00:00:00Z'},{action:'flag',to:'Resolved',at:'2026-10-27T00:00:00Z'}]};
  assert.equal(resolutionDays(report),2);
});
