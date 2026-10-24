import { randomUUID } from 'node:crypto';
import { transaction,nowIso } from './db.mjs';
import { MeteringError } from './metering.mjs';
import { toMicro } from './money.mjs';
import { checkSchema } from './upstream-schema.mjs';
import { endpointUrl } from './upstream-http.mjs';
import { sealSecret } from './upstream-secrets.mjs';

const bad=message=>{throw new MeteringError(-32602,message);};
export function providerFor(db,workspaceId) {
  return db.prepare('SELECT a.* FROM accounts a JOIN workspace_providers p ON p.provider_account_id=a.id WHERE p.workspace_account_id=?').get(workspaceId)||null;
}
export function requireProvider(db,workspaceId) {const provider=providerFor(db,workspaceId);if(!provider)throw new MeteringError(-32001,'Create your provider profile first');return provider;}
export function createProvider(db,workspaceId,{name,paypal_email}) {
  if(typeof name!=='string'||!name.trim()||name.trim().length>60)bad('Use a provider name of 1–60 characters');
  if(typeof paypal_email!=='string'||paypal_email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypal_email))bad('Enter a PERSONAL PayPal sandbox email');
  return transaction(db,()=>{
    if(providerFor(db,workspaceId))bad('A provider profile already exists');
    const id='provider_'+randomUUID();
    db.prepare("INSERT INTO accounts (id,kind,display_name,paypal_email,api_key,created_at) VALUES (?,'provider',?,?,?,?)").run(id,name.trim(),paypal_email.trim(),'disabled_'+randomUUID(),nowIso());
    db.prepare('INSERT INTO workspace_providers VALUES (?,?)').run(workspaceId,id);
    return {id,name:name.trim()};
  });
}
export function updateProvider(db,workspaceId,{name,paypal_email}) {
  const provider=requireProvider(db,workspaceId);
  if(typeof name!=='string'||!name.trim()||name.trim().length>60||typeof paypal_email!=='string'||paypal_email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypal_email))bad('Enter a short provider name and PERSONAL sandbox email');
  transaction(db,()=>{
    if(db.prepare("SELECT id FROM payouts WHERE provider_account_id=? AND status IN ('QUEUED','SENT')").get(provider.id))bad('Resolve the pending payout before changing the recipient');
    db.prepare('UPDATE accounts SET display_name=?,paypal_email=? WHERE id=?').run(name.trim(),paypal_email.trim(),provider.id);
  });
}
export function toolForOwner(db,providerId,id) {
  const tool=db.prepare('SELECT t.*,u.* FROM tools t JOIN tool_upstreams u ON u.tool_id=t.id WHERE t.id=? AND t.owner_account_id=?').get(id,providerId);
  if(!tool)bad('Unknown tool');return tool;
}
export function priceInput(value) {
  let price;try{price=toMicro(value);}catch{bad('Use a USD price with at most six decimal places');}
  if(price<1||price>1_000_000)bad('Sandbox tools cost $0.000001–$1.00 per successful call');return price;
}
function credential(input,key,toolId,providerId) {
  if(!['none','bearer','x-api-key'].includes(input.auth_mode))bad('Choose no authentication, Bearer or X-API-Key');
  if(typeof input.auth_secret!=='string'||input.auth_secret.length>4096||/[\r\n]/.test(input.auth_secret))bad('Use a single-line upstream secret under 4096 characters');
  if(input.auth_mode==='none'&&input.auth_secret||input.auth_mode!=='none'&&!input.auth_secret)bad('The authentication mode and secret must agree');
  return sealSecret(key,input.auth_secret,toolId+'\0'+providerId);
}
export function registerProviderTool(db,providerId,input,{key,base,allowLoopback=false}) {
  if(typeof input.name!=='string'||!/^[a-z][a-z0-9_]{2,30}$/.test(input.name))bad('Use a tool name of 3–31 lowercase letters, digits or underscores');
  if(typeof input.description!=='string'||!input.description.trim()||input.description.length>300)bad('Describe the tool in 1–300 characters');
  if(!['http','mcp'].includes(input.kind))bad('Choose a JSON HTTP API or Streamable HTTP MCP tool');
  if(input.read_only!==true)bad('This release registers read-only, retry-safe tools only');
  let endpoint;try{endpoint=endpointUrl(input.endpoint,{base,allowLoopback}).href;}catch(error){bad(error.message);}
  if(input.kind==='mcp'&&(typeof input.remote_tool!=='string'||!input.remote_tool||input.remote_tool.length>100))bad('Name the upstream MCP tool');
  const schema=checkSchema(input.input_schema),price=priceInput(input.price_usd),id='tool_'+randomUUID();
  const cipher=credential(input,key,id,providerId);
  const name='p_'+providerId.replaceAll('-','').slice(-12)+'_'+input.name;
  return transaction(db,()=>{
    if(db.prepare('SELECT COUNT(*) n FROM tools WHERE owner_account_id=?').get(providerId).n>=10)bad('This sandbox allows ten registered tools per provider');
    if(db.prepare('SELECT id FROM tools WHERE name=?').get(name))bad('This provider already registered that tool name');
    db.prepare("INSERT INTO tools (id,owner_account_id,name,slug,description,price_micro,input_schema,handler,enabled,created_at) VALUES (?,?,?,?,?,?,?,'remote',0,?)").run(id,providerId,name,id,input.description.trim(),price,JSON.stringify(schema),nowIso());
    db.prepare('INSERT INTO tool_upstreams (tool_id,kind,endpoint,remote_tool,auth_mode,auth_cipher) VALUES (?,?,?,?,?,?)').run(id,input.kind,endpoint,input.kind==='mcp'?input.remote_tool:null,input.auth_mode,cipher);
    return {id,name,price_micro:price,enabled:false};
  });
}
export function changeToolPrice(db,providerId,id,value) {
  const price=priceInput(value);toolForOwner(db,providerId,id);
  transaction(db,()=>{db.prepare('UPDATE tools SET price_micro=? WHERE id=?').run(price,id);db.prepare('UPDATE tool_upstreams SET revision=revision+1 WHERE tool_id=?').run(id);});
}
export function setToolPublished(db,providerId,id,published) {
  const tool=toolForOwner(db,providerId,id);if(typeof published!=='boolean')bad('Set published to true or false');
  if(published&&!tool.tested_at)bad('Test the connection successfully before publishing');
  if(published&&!tool.enabled&&db.prepare("SELECT COUNT(*) n FROM tools WHERE handler='remote' AND enabled=1").get().n>=50)bad('This sandbox catalogue is limited to 50 published provider tools');
  db.prepare('UPDATE tools SET enabled=? WHERE id=?').run(published?1:0,id);
}
export function replaceToolCredential(db,providerId,id,input,key) {
  toolForOwner(db,providerId,id);const cipher=credential(input,key,id,providerId);
  transaction(db,()=>{db.prepare('UPDATE tools SET enabled=0 WHERE id=?').run(id);db.prepare('UPDATE tool_upstreams SET auth_mode=?,auth_cipher=?,tested_at=NULL,last_error=NULL,revision=revision+1 WHERE tool_id=?').run(input.auth_mode,cipher,id);});
}
export function providerSnapshot(db,workspaceId,base) {
  const profile=providerFor(db,workspaceId);
  const account=db.prepare('SELECT id,display_name FROM accounts WHERE id=?').get(workspaceId);
  if(!profile)return {account,provider:null,tools:[],calls:[],payouts:[],example_api:new URL('/examples/invoice-api',base).href,example_mcp:new URL('/examples/invoice-mcp',base).href};
  return {account,provider:{id:profile.id,display_name:profile.display_name,paypal_email:profile.paypal_email,balance_micro:profile.balance_micro,reserved_micro:profile.reserved_micro},
    tools:db.prepare('SELECT t.id,t.name,t.description,t.price_micro,t.enabled,t.input_schema,u.kind,u.endpoint,u.remote_tool,u.auth_mode,(u.auth_cipher IS NOT NULL) has_auth,u.tested_at,u.last_error,u.revision FROM tools t JOIN tool_upstreams u ON u.tool_id=t.id WHERE t.owner_account_id=? ORDER BY t.rowid DESC').all(profile.id),
    calls:db.prepare('SELECT c.id,t.name tool_name,c.price_micro,c.author_credit_micro,c.status,c.created_at FROM calls c JOIN tools t ON t.id=c.tool_id WHERE c.owner_account_id=? ORDER BY c.rowid DESC LIMIT 50').all(profile.id),
    payouts:db.prepare('SELECT id,amount_micro,fee_micro,paypal_batch_id,status,created_at FROM payouts WHERE provider_account_id=? ORDER BY rowid DESC LIMIT 30').all(profile.id),
    example_api:new URL('/examples/invoice-api',base).href,example_mcp:new URL('/examples/invoice-mcp',base).href};
}
