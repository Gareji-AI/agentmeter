// One fresh local take; the archived sandbox writer and hosted ledger are never opened.
import { mkdirSync,mkdtempSync,writeFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { availableAnalyticsLicense } from '../src/analytics-license.mjs';

export function recordingEnvironment(env,databasePath){
  return {...env,PAYPAL_MODE:'mock',PAYPAL_API_BASE:'https://api-m.sandbox.paypal.com',
    PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:'',PAYPAL_PAYOUT_CLIENT_ID:'',PAYPAL_PAYOUT_CLIENT_SECRET:'',
    PAYPAL_WEBHOOK_ID:'',PAYPAL_SANDBOX_RECIPIENT:'author@example.com',PAYOUT_MODE:'execute',
    HOST:'127.0.0.1',PORT:'0',PUBLIC_BASE_URL:'http://127.0.0.1:0',RENDER_EXTERNAL_URL:'',
    DATABASE_PATH:databasePath,DEMO_ACCESS_TOKEN:'local-recording-only',GEMINI_WIDGETS_ONLY:'1'};
}

export async function startRecording(){
  const root=dirname(dirname(fileURLToPath(import.meta.url)));process.chdir(root);
  try{process.loadEnvFile();}catch(error){if(error.code!=='ENOENT')throw error;}
  const missing=['GEMINI_API_KEY','AG_GRID_LICENSE_KEY','AG_STUDIO_LICENSE_KEY'].filter(key=>key==='GEMINI_API_KEY'?!process.env[key]:!availableAnalyticsLicense(process.env[key]));
  if(missing.length)throw Error(`Recording needs configured, active ${missing.join(', ')}. Use npm start for the offline demo.`);
  const directory=join(root,'data','recordings');mkdirSync(directory,{recursive:true});
  const take=mkdtempSync(join(directory,'take-'));Object.assign(process.env,recordingEnvironment(process.env,join(take,'ledger.sqlite')));
  const {start}=await import('../src/server.mjs');const app=await start();
  const base=`http://127.0.0.1:${app.server.address().port}`;
  app.ctx.publicBaseUrl=base;app.paypal.config.publicBaseUrl=base;
  const manifest={created_at:new Date().toISOString(),base,database_path:process.env.DATABASE_PATH,
    payment_mode:'mock',widget_ai:'Gemini',other_ai:'deterministic',screens:['/app','/provider','/reconcile','/grid'].map(path=>base+path)};
  writeFileSync(join(take,'take.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  console.log(`Recording take: ${take}\nMoney: MOCK; widget intent: real Gemini; Studio/Grid: configured.\nOpen: ${base}/app\nEach new npm run demo:record uses a new ledger. Ctrl-C stops this take without deleting it.`);
  return {app,manifest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startRecording().catch(error=>{console.error(error.message);process.exitCode=1;});
