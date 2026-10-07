import test from 'node:test';
import assert from 'node:assert/strict';
import { operationsDay } from '../src/utils/operationsDay.js';
test('operations uses Kampala midnight rather than UTC midnight',()=>{
 const range=operationsDay('2026-10-08',-180);
 assert.equal(range.gte.toISOString(),'2026-10-07T21:00:00.000Z');
 assert.equal(range.lt.toISOString(),'2026-10-08T21:00:00.000Z');
});
test('operations handles daylight saving and rejects invalid dates/offsets',()=>{
 const range=operationsDay('2026-03-08',300,240);
 assert.equal(range.lt-range.gte,23*3600000);
 for(const args of [['2026-02-30'],['bad'],['2026-10-08',900],['2026-10-08','bad']]) assert.throws(()=>operationsDay(...args));
});
