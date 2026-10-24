import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedCall, invoices, safeResult } from '../scripts/video/live-codex.mjs';
import { captureLineSink } from '../scripts/video/cli-recording.mjs';

test('CLI filming never emits a partial credential split across stream chunks', () => {
  const chunks=[];const key='private-test-token-123456';
  const sink=captureLineSink(s=>chunks.push(s),[key,'/Users/private-person']);
  sink.write('token: private-test-');assert.equal(chunks.length,0);
  sink.write('token-123456\n\x1b[32mInvoice DEMO-201: $0.01\x1b[0m\n');
  sink.write('/Users/private-');sink.write('person/demo');sink.end();
  const output=chunks.join('');assert.equal(output,'token: [private]\nInvoice DEMO-201: $0.01\n[private]/demo');
  for(const chunk of chunks)assert.ok(!chunk.includes(key)&&!chunk.includes('private-test-')&&!chunk.includes('/Users/private-'));
});

test('filming gateway binds retries to three approved inputs and a one-cent quote', () => {
  const nonces = ['invoice-one', 'invoice-two', 'invoice-three'];
  for (let i = 0; i < invoices.length; i++) {
    const first = boundedCall('invoice_api', nonces, { name: 'invoice_api', arguments: { text: invoices[i] } });
    const retry = boundedCall('invoice_api', nonces, { name: 'invoice_api', arguments: { text: invoices[i], _request_id: 'model-invented-new-id', _max_price_micro: 10000 } });
    assert.deepEqual(retry, first);
    assert.equal(first.arguments._request_id, nonces[i]);
    assert.equal(first.arguments._max_price_micro, 10000);
  }
  for (const params of [
    { name: 'other_tool', arguments: { text: invoices[0] } },
    { name: 'invoice_api', arguments: { text: 'A fourth invoice' } },
    { name: 'invoice_api', arguments: { text: invoices[0], _max_price_micro: 20000 } },
    { name: 'invoice_api', arguments: { text: invoices[0], callback: 'https://example.com' } }
  ]) assert.throws(() => boundedCall('invoice_api', nonces, params));
});

test('filming output omits private fields and rejects unrecognized receipt content', () => {
  const result = { isError: false, structuredContent: { invoice_id: 'DEMO-201', amounts: ['$120.00'], due_dates: ['2026-11-12'], review_required: true,
    contacts: ['private@example.invalid'], credential: 'private-token',
    _agentmeter_receipt: { call_id: 'call_example123', status: 'SETTLED', price_micro: 10000, charged_this_request_micro: 10000, balance_available_micro: 4930000, reused: false, account_id: 'private-account' } } };
  const serialized = JSON.stringify(safeResult(result));
  for (const secret of ['private@example.invalid', 'private-token', 'private-account']) assert.ok(!serialized.includes(secret));
  for (const change of [{ amounts: ['private@example.invalid'] }, { invoice_id: 'real-customer' }, { due_dates: ['sensitive-notes'] }]) {
    assert.throws(() => safeResult({ ...result, structuredContent: { ...result.structuredContent, ...change } }));
  }
});
