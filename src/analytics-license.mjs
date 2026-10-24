/** Never load an expired trial. The vendor still validates active keys in the browser. */
export function availableAnalyticsLicense(key,now=Date.now()) {
  if(typeof key!=='string'||!key.trim())return '';
  if(!key.includes('[TRIAL]'))return key;
  const payload=key.slice(0,-32).split('_').at(-1);
  if(!payload||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return '';
  const expiry=Number(Buffer.from(payload,'base64').toString('utf8'));
  return Number.isSafeInteger(expiry)&&expiry>now?key:'';
}
