import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { transaction } from '../src/db.mjs';

test('SQLite rejects fractional, negative, excessive reservations and unsafe money',t=>{
  const db=fixture();t.after(()=>db.close());
  for(const value of [-1,0.5,9007199254740992]) assert.throws(()=>db.prepare("UPDATE accounts SET balance_micro=? WHERE id='buyer'").run(value));
  assert.throws(()=>db.prepare("UPDATE accounts SET reserved_micro=6000000 WHERE id='buyer'").run());
  assert.throws(()=>db.prepare("UPDATE tools SET price_micro=-1").run());
});
test('nested transactions roll back all child writes on outer failure',t=>{
  const db=fixture();t.after(()=>db.close());
  assert.throws(()=>transaction(db,()=>{transaction(db,()=>db.prepare("UPDATE accounts SET display_name='Changed' WHERE id='buyer'").run());throw new Error('rollback');}));
  assert.equal(db.prepare("SELECT display_name FROM accounts WHERE id='buyer'").get().display_name,'Buyer');
});
