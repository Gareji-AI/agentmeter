import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import { readFileSync,writeFileSync,statSync } from 'node:fs';
export function upstreamKey(db) {
  const file=db.prepare('PRAGMA database_list').all().find(r=>r.name==='main').file;
  if(!file)return randomBytes(32);
  const path=file+'.upstream-key';
  try{writeFileSync(path,randomBytes(32),{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  const key=readFileSync(path);if(key.length!==32||(statSync(path).mode&0o077))throw Error('Upstream encryption key must be a private 32-byte file');return key;
}
export function sealSecret(key,plain,context) {
  if(!plain)return null;const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(context));
  return [iv,Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]),cipher.getAuthTag()].map(b=>b.toString('base64')).join('.');
}
export function openSecret(key,sealed,context) {
  if(!sealed)return '';const [iv,data,tag]=sealed.split('.').map(x=>Buffer.from(x,'base64'));const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(context));cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
