// Private first-deploy bootstrap. No HTTP import route and no overwrite of a ledger.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { existsSync,mkdirSync,writeFileSync,linkSync,unlinkSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertLedger } from '../src/metering.mjs';

function validate(path) {
  const db=new DatabaseSync(path,{readOnly:true});
  try {
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Imported SQLite integrity check failed');
    if(db.prepare("SELECT value FROM metadata WHERE key='payment_mode'").get()?.value!=='live')throw new Error('Only a sandbox ledger may be imported');
    assertLedger(db);
  }finally{db.close();}
}
export function importLedger(env=process.env) {
  const destination=resolve(env.DATABASE_PATH||'data/agentmeter-sandbox.sqlite');
  if(existsSync(destination)){if(env.REQUIRE_EXISTING_LEDGER==='1'||env.LEDGER_IMPORT_GZIP_BASE64)validate(destination);return 'existing';}
  if(!env.LEDGER_IMPORT_GZIP_BASE64){if(env.REQUIRE_EXISTING_LEDGER==='1')throw new Error('Existing sandbox ledger or private import is required before startup');return 'not_requested';}
  if(!/^[a-f0-9]{64}$/.test(env.LEDGER_IMPORT_SHA256||''))throw new Error('A SHA-256 checksum is required for ledger import');
  const bytes=gunzipSync(Buffer.from(env.LEDGER_IMPORT_GZIP_BASE64,'base64'),{maxOutputLength:8*1024*1024});
  if(createHash('sha256').update(bytes).digest('hex')!==env.LEDGER_IMPORT_SHA256)throw new Error('Ledger import checksum mismatch');
  mkdirSync(dirname(destination),{recursive:true});
  const temporary=destination+'.import-'+process.pid;
  writeFileSync(temporary,bytes,{flag:'wx',mode:0o600});
  try{validate(temporary);linkSync(temporary,destination);}finally{unlinkSync(temporary);}
  return 'imported';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{console.log('Sandbox ledger bootstrap: '+importLedger());}
  catch(error){console.error(error.message);process.exitCode=1;}
}
