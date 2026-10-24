import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMicro, microToPayPalAmount, formatMicro, feeOf } from '../src/money.mjs';

test('decimal strings preserve exact micro-dollars and reject silent truncation', () => {
  assert.equal(toMicro('5.000001'),5_000_001);
  assert.equal(toMicro('-0.000001'),-1);
  for (const value of [0.1,'1.0000001','NaN','1e3','9007199254.740992']) assert.throws(()=>toMicro(value));
});
test('PayPal conversion rounds with integer arithmetic at boundaries', () => {
  assert.equal(microToPayPalAmount(4_999),'0.00');
  assert.equal(microToPayPalAmount(5_000),'0.01');
  assert.equal(microToPayPalAmount(-5_000),'-0.01');
  assert.equal(formatMicro(10_000),'0.0100');
  assert.equal(feeOf(Number.MAX_SAFE_INTEGER,349),Number(BigInt(Number.MAX_SAFE_INTEGER)*349n/10_000n));
  assert.throws(()=>microToPayPalAmount(0.1));
});
