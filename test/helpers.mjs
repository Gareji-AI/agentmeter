import { openDb, nowIso } from '../src/db.mjs';
import { BUILTIN_TOOLS } from '../src/tools.mjs';

export function fixture(balance = 5_000_000, db = openDb(':memory:')) {
  const at = nowIso();
  db.prepare('INSERT INTO accounts (id,kind,display_name,api_key,balance_micro,created_at) VALUES (?,?,?,?,?,?)').run('buyer','consumer','Buyer','buyer-key',balance,at);
  db.prepare('INSERT INTO accounts (id,kind,display_name,api_key,paypal_email,created_at) VALUES (?,?,?,?,?,?)').run('author','provider','Author','author-key','author@example.com',at);
  if (balance) db.prepare("INSERT INTO topups (id,account_id,paypal_order_id,amount_micro,status,created_at) VALUES ('initial','buyer','INITIAL',?,'CAPTURED',?)").run(balance,at);
  for (const tool of BUILTIN_TOOLS) db.prepare('INSERT INTO tools (id,owner_account_id,name,slug,description,price_micro,input_schema,handler,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(tool.slug,'author',tool.name,tool.slug,tool.description,tool.priceMicro,JSON.stringify(tool.inputSchema),tool.handler,at);
  return db;
}
export const request = (key = 'first', extra = {}) => ({ accountId:'buyer', toolName:'extract_entities',args:{text:'Contact demo@example.com for $5.'},idempotencyKey:key,...extra });
