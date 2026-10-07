import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginThrottle } from '../src/middleware/loginThrottle.js';
function request(middleware, ip) {
  const result = { next: false, headers: {} };
  middleware({ ip }, { set(k,v) { result.headers[k]=v; }, status(code) { result.status=code; return this; }, json(body) { result.body=body; } }, () => { result.next=true; });
  return result;
}
test('login throttle limits attempts, separates clients and resets after expiry', () => {
  let time=0;
  const middleware=createLoginThrottle({limit:2,windowMs:1000,now:()=>time});
  assert.equal(request(middleware,'a').next,true);
  assert.equal(request(middleware,'a').next,true);
  const blocked=request(middleware,'a');
  assert.equal(blocked.status,429); assert.equal(blocked.headers['Retry-After'],'1');
  assert.equal(request(middleware,'b').next,true);
  time=1000; assert.equal(request(middleware,'a').next,true);
});
test('capacity cannot evict a blocked client and expires safely', () => {
  let time=0;
  const middleware=createLoginThrottle({limit:1,windowMs:1000,maxEntries:1,now:()=>time});
  request(middleware,'a');
  assert.equal(request(middleware,'b').status,429);
  assert.equal(request(middleware,'a').status,429);
  time=1000; assert.equal(request(middleware,'b').next,true);
});
