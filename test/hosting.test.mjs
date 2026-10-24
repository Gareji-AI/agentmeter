import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPayPal } from '../src/paypal.mjs';
test('Render origin supplies PayPal return URLs without a separate PUBLIC_BASE_URL',()=>{
  const paypal=createPayPal({PAYPAL_MODE:'mock',RENDER_EXTERNAL_URL:'https://agentmeter-test.onrender.com'});
  assert.equal(paypal.config.publicBaseUrl,'https://agentmeter-test.onrender.com');
});
