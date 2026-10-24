import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fixture } from './helpers.mjs';
import { openDb } from '../src/db.mjs';
import { importLedger } from '../scripts/import-ledger.mjs';
function capsule(t,{mode='live',invalid=false}={}) {
  const dir=mkdtempSync(join(tmpdir(),'agentmeter-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const source=join(dir,'source.sqlite'),destination=join(dir,'target.sqlite');const db=fixture(5_000_000,openDb(source));
  db.exec('CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)');db.prepare("INSERT INTO metadata VALUES('payment_mode',?)").run(mode);
  if(invalid)db.prepare("UPDATE accounts SET balance_micro=123 WHERE id='buyer'").run();db.close();const bytes=readFileSync(source);
  return {destination,env:{DATABASE_PATH:destination,REQUIRE_EXISTING_LEDGER:'1',LEDGER_IMPORT_GZIP_BASE64:gzipSync(bytes).toString('base64'),LEDGER_IMPORT_SHA256:createHash('sha256').update(bytes).digest('hex')}};
}
test('sandbox import preserves exact ledger identities and never overwrites on restart',t=>{
  const {env,destination}=capsule(t);assert.equal(importLedger(env),'imported');const db=openDb(destination);assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='buyer'").get().balance_micro,5_000_000);assert.equal(db.prepare("SELECT api_key FROM accounts WHERE id='buyer'").get().api_key,'buyer-key');db.close();
  const before=readFileSync(destination);assert.equal(importLedger({...env,LEDGER_IMPORT_GZIP_BASE64:'bad'}),'existing');assert.deepEqual(readFileSync(destination),before);
});
test('checksum mismatch and missing required ledger fail before creating the destination',t=>{
  const {env,destination}=capsule(t);assert.throws(()=>importLedger({...env,LEDGER_IMPORT_SHA256:'0'.repeat(64)}),/checksum mismatch/);assert.equal(existsSync(destination),false);
  assert.throws(()=>importLedger({...env,LEDGER_IMPORT_GZIP_BASE64:''}),/required before startup/);assert.equal(existsSync(destination),false);
});
test('mock and unbalanced snapshots cannot become the hosted sandbox ledger',t=>{
  for(const options of [{mode:'mock'},{invalid:true}]){const {env,destination}=capsule(t,options);assert.throws(()=>importLedger(env));assert.equal(existsSync(destination),false);}
});
