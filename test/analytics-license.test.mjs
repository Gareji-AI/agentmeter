import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableAnalyticsLicense,analyticsConfiguration } from '../src/analytics-license.mjs';

const trial=expiry=>'[TRIAL]_fixture_[v3]_[0102]_'+Buffer.from(String(expiry)).toString('base64')+'0'.repeat(32);

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

test('staggered trial expiry keeps analytics enabled without sending expired keys',()=>{
  const gridExpiry=Date.UTC(2026,10,23),studioExpiry=Date.UTC(2026,11,8);
  const env={AG_GRID_LICENSE_KEY:trial(gridExpiry),AG_STUDIO_LICENSE_KEY:trial(studioExpiry)};
  assert.deepEqual(analyticsConfiguration(env,gridExpiry-1),{gridLicense:env.AG_GRID_LICENSE_KEY,studioLicense:env.AG_STUDIO_LICENSE_KEY,analyticsEvaluation:false,studioEnabled:true});
  assert.deepEqual(analyticsConfiguration(env,gridExpiry),{gridLicense:'',studioLicense:env.AG_STUDIO_LICENSE_KEY,analyticsEvaluation:true,studioEnabled:true});
  for(const now of [studioExpiry,Date.UTC(2026,11,16),Date.UTC(2027,0,1)]) {
    assert.deepEqual(analyticsConfiguration(env,now),{gridLicense:'',studioLicense:'',analyticsEvaluation:true,studioEnabled:true});
  }
  assert.equal(env.AG_STUDIO_LICENSE_KEY,trial(studioExpiry));
});

test('no-key evaluation is opt-in; ordinary offline and Grid-only setups stay distinct',()=>{
  assert.deepEqual(analyticsConfiguration({}),{gridLicense:'',studioLicense:'',analyticsEvaluation:false,studioEnabled:false});
  assert.deepEqual(analyticsConfiguration({AG_ANALYTICS_EVALUATION:'1'}),{gridLicense:'',studioLicense:'',analyticsEvaluation:true,studioEnabled:true});
  assert.equal(analyticsConfiguration({AG_GRID_LICENSE_KEY:trial(0)}).studioEnabled,false);
  assert.equal(analyticsConfiguration({AG_STUDIO_LICENSE_KEY:'commercial-key'}).studioLicense,'commercial-key');
});
