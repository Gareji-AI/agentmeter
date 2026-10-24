import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableAnalyticsLicense } from '../src/analytics-license.mjs';

test('expired or malformed trials fall back while active keys remain unmodified',()=>{
  const expiry=Date.UTC(2026,10,23);
  // Synthetic expiry fixture, never a vendor-issued license.
  const trial='[TRIAL]_fixture_[v3]_[0102]_'+Buffer.from(String(expiry)).toString('base64')+'0'.repeat(32);
  assert.equal(availableAnalyticsLicense(trial,expiry-1),trial);
  assert.equal(availableAnalyticsLicense(trial,expiry),'');
  assert.equal(availableAnalyticsLicense(trial,expiry+1),'');
  for(const value of [undefined,null,'',' ','[TRIAL]_broken','[TRIAL]_!!!'+'0'.repeat(32)])assert.equal(availableAnalyticsLicense(value),'');
  assert.equal(availableAnalyticsLicense('commercial-key-preserved'),'commercial-key-preserved');
});
