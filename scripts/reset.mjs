import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { paypalConfigFromEnv } from '../src/paypal.mjs';
try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
if(paypalConfigFromEnv().mode!=='mock'||!process.argv.includes('--confirm')) {
  console.error('Stop the server, then run PAYPAL_MODE=mock npm run reset -- --confirm to delete the selected mock database. Sandbox data is never reset by this script.');process.exitCode=1;
}else{
  const path=resolve(process.env.DATABASE_PATH||'data/agentmeter-mock.sqlite');
  for(const suffix of ['','-wal','-shm'])rmSync(path+suffix,{force:true});
  console.log('Mock database removed. npm start will seed a fresh demo.');
}
