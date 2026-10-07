import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseOrderHtml } from '../../frontend/src/utils/purchaseOrderPrint.js';
const order = { number: 'PO-TEST', status: 'DRAFT', createdAt: '2026-09-19T10:00:00Z', currency: 'UGX', total: 25,
  supplier: {name:'<script>alert(1)</script>', address:'Main & First'}, branch:{name:'Main'}, createdBy:{name:'Owner'},
  items:[{productName:'A "quoted" product', quantity:2,unitCost:12.5,lineTotal:25}], note:'<img src=x onerror=alert(1)>' };
test('purchase print escapes untrusted content and preserves amounts and draft notice', () => {
  const html = purchaseOrderHtml(order,{name:'Test shop'});
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Main &amp; First'));
  assert.ok(html.includes('12.50')); assert.ok(html.includes('25.00'));
  assert.ok(html.includes('DRAFT — NOT APPROVED'));
  assert.ok(html.includes('not proof of payment'));
});
test('cancelled purchase print warns against further delivery', () => {
  const html = purchaseOrderHtml({...order,status:'CANCELLED'},{name:'Test shop'});
  assert.ok(html.includes('Do not deliver unreceived quantities.'));
  assert.ok(!html.includes('This draft has not been approved.'));
});
