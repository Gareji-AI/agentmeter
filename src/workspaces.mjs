import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { transaction,nowIso } from './db.mjs';
import { MeteringError } from './metering.mjs';

export const secretHash=value=>createHash('sha256').update(String(value)).digest('hex');
const secret=prefix=>prefix+randomBytes(32).toString('hex');
const denied=()=>{throw new MeteringError(-32001,'Workspace sign-in required');};
export function createWorkspace(db,name) {
  if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw new MeteringError(-32602,'Use a workspace name of 1–60 characters');
  return transaction(db,()=>{
    if(db.prepare('SELECT COUNT(*) n FROM workspace_credentials').get().n>=500)throw new MeteringError(-32602,'This sandbox has reached its workspace limit');
    const id='workspace_'+randomUUID(),recoveryCode=secret('am_recovery_');
    // Public accounts never receive a legacy plaintext bearer key.
    db.prepare("INSERT INTO accounts (id,kind,display_name,api_key,created_at) VALUES (?,'consumer',?,?,?)").run(id,name.trim(),'disabled_'+randomUUID(),nowIso());
    db.prepare('INSERT INTO workspace_credentials VALUES (?,?)').run(id,secretHash(recoveryCode));
    return {id,name:name.trim(),recovery_code:recoveryCode};
  });
}
export function signInWorkspace(db,recoveryCode) {
  if(typeof recoveryCode!=='string'||!/^am_recovery_[a-f0-9]{64}$/.test(recoveryCode))denied();
  const row=db.prepare('SELECT account_id FROM workspace_credentials WHERE recovery_hash=?').get(secretHash(recoveryCode));
  if(!row)denied();return row.account_id;
}
export function createWorkspaceSession(db,accountId) {
  const token=secret('am_session_');
  db.prepare('DELETE FROM workspace_sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('DELETE FROM workspace_sessions WHERE account_id=? AND token_hash NOT IN (SELECT token_hash FROM workspace_sessions WHERE account_id=? ORDER BY expires_at DESC LIMIT 19)').run(accountId,accountId);
  db.prepare('INSERT INTO workspace_sessions VALUES (?,?,?)').run(secretHash(token),accountId,Date.now()+7*86400000);
  return token;
}
export function workspaceSession(db,cookie) {
  const token=cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('am_customer='))?.slice(12);
  if(!token||token.length>100)return null;
  return db.prepare('SELECT account_id FROM workspace_sessions WHERE token_hash=? AND expires_at>?').get(secretHash(token),Date.now())?.account_id||null;
}
export function logoutWorkspace(db,cookie) {
  const token=cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('am_customer='))?.slice(12);
  if(token)db.prepare('DELETE FROM workspace_sessions WHERE token_hash=?').run(secretHash(token));
}
export function issueClientKey(db,accountId,label) {
  if(typeof label!=='string'||!label.trim()||label.trim().length>60)throw new MeteringError(-32602,'Use a key label of 1–60 characters');
  return transaction(db,()=>{
    if(db.prepare('SELECT COUNT(*) n FROM client_keys WHERE account_id=? AND revoked_at IS NULL').get(accountId).n>=5)throw new MeteringError(-32602,'Revoke an existing key before creating another (maximum five active keys)');
    const id='key_'+randomUUID(),key=secret('am_client_');
    db.prepare('INSERT INTO client_keys (id,account_id,key_hash,label,suffix,created_at) VALUES (?,?,?,?,?,?)').run(id,accountId,secretHash(key),label.trim(),key.slice(-6),nowIso());
    return {id,key,label:label.trim()};
  });
}
export function revokeClientKey(db,accountId,id) {
  const changed=db.prepare('UPDATE client_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND account_id=?').run(nowIso(),id,accountId);
  if(!changed.changes)throw new MeteringError(-32602,'Unknown key');
}
export function workspaceSnapshot(db,accountId,base) {
  const account=db.prepare('SELECT id,display_name,balance_micro,reserved_micro FROM accounts WHERE id=?').get(accountId);
  if(!account)denied();
  return {account,mcp_url:new URL('/mcp',base).href,
    policies:db.prepare('SELECT cap_micro FROM budget_policies WHERE account_id=? AND tool_id IS NULL AND active=1').all(accountId),
    keys:db.prepare('SELECT id,label,suffix,created_at,revoked_at FROM client_keys WHERE account_id=? ORDER BY revoked_at IS NOT NULL,rowid DESC LIMIT 50').all(accountId),
    calls:db.prepare('SELECT c.id,c.status,c.price_micro,c.author_credit_micro,c.created_at,t.name tool_name FROM calls c JOIN tools t ON t.id=c.tool_id WHERE c.account_id=? ORDER BY c.rowid DESC LIMIT 50').all(accountId),
    topups:db.prepare('SELECT id,paypal_order_id,amount_micro,fee_micro,status,created_at FROM topups WHERE account_id=? ORDER BY rowid DESC LIMIT 30').all(accountId),
    tools:db.prepare('SELECT t.name,t.description,t.price_micro,a.display_name author,u.kind,u.endpoint FROM tools t JOIN accounts a ON a.id=t.owner_account_id LEFT JOIN tool_upstreams u ON u.tool_id=t.id WHERE t.enabled=1 ORDER BY t.price_micro,t.name').all().map(({endpoint,...tool})=>({...tool,upstream_host:endpoint?new URL(endpoint).host:null}))};
}
