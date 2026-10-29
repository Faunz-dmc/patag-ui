import test from 'node:test';
import assert from 'node:assert/strict';
import { validCoordinates, mapSettings } from '../src/map.ts';
test('map token states fail clearly and never accept secret tokens',()=>{
  assert.equal(mapSettings().url,'');assert.match(mapSettings().message,/VITE_MAPBOX_TOKEN/);
  assert.equal(mapSettings('sk.private').url,'');assert.equal(mapSettings('invalid').url,'');
  assert.match(mapSettings('pk.public').url,/mapbox\/streets-v12\/tiles\/256/);
});
test('map coordinates reject NaN, Infinity, absent and out-of-range values',()=>{
  for(const v of [undefined,{lat:NaN,lng:120},{lat:Infinity,lng:120},{lat:91,lng:120},{lat:14,lng:-181}]) assert.equal(validCoordinates(v),false);
  assert.equal(validCoordinates({lat:14.855,lng:120.815}),true);
});
