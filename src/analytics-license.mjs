/** Never load an expired trial. The vendor still validates active keys in the browser. */
export function availableAnalyticsLicense(key,now=Date.now()) {
  if(typeof key!=='string'||!key.trim())return '';
  if(!key.includes('[TRIAL]'))return key;
  const payload=key.slice(0,-32).split('_').at(-1);
  if(!payload||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return '';
  const expiry=Number(Buffer.from(payload,'base64').toString('utf8'));
  return Number.isSafeInteger(expiry)&&expiry>now?key:'';
}

/** Hackathon evaluation retains the vendor watermark; never alter a trial key. */
export function analyticsConfiguration(env,now=Date.now()) {
  const gridLicense=availableAnalyticsLicense(env.AG_GRID_LICENSE_KEY,now);
  const studioLicense=availableAnalyticsLicense(env.AG_STUDIO_LICENSE_KEY,now);
  const expiredTrial=(key,available)=>typeof key==='string'&&key.includes('[TRIAL]')&&!available;
  const analyticsEvaluation=env.AG_ANALYTICS_EVALUATION==='1'
    ||expiredTrial(env.AG_GRID_LICENSE_KEY,gridLicense)
    ||expiredTrial(env.AG_STUDIO_LICENSE_KEY,studioLicense);
  return {gridLicense,studioLicense,analyticsEvaluation,
    studioEnabled:Boolean(studioLicense||analyticsEvaluation&&(env.AG_STUDIO_LICENSE_KEY?.trim()||env.AG_ANALYTICS_EVALUATION==='1'))};
}
