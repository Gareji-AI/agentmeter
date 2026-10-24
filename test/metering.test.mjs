import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request } from './helpers.mjs';
import { callTool, reserve, settle, release, setBudget, assertLedger, recoverReservations } from '../src/metering.mjs';

test('three calls move exactly $0.03 from buyer to author', t => {
  const db=fixture();t.after(()=>db.close());
  for(let i=0;i<3;i++)callTool(db,request(String(i)));
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='buyer'").get().balance_micro,4_970_000);
  assert.equal(db.prepare("SELECT balance_micro FROM accounts WHERE id='author'").get().balance_micro,30_000);
  assertLedger(db);
});
test('canonical arguments and scoped idempotency replay without double charging', t => {
  const db=fixture();t.after(()=>db.close());
  const first=callTool(db,request());const second=callTool(db,request());
  assert.equal(second.reused,true);assert.equal(first.call.id,second.call.id);
  assert.throws(()=>callTool(db,request('first',{args:{text:'different'}})),e=>e.code===-32003);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM calls').get().n,1);assertLedger(db);
});
test('reservations prevent exhaustion and cap races', t => {
  const db=fixture(20_000);t.after(()=>db.close());
  reserve(db,request('a'));reserve(db,request('b'));
  assert.throws(()=>reserve(db,request('c')),e=>e.code===-32002);
  assertLedger(db);
  release(db,db.prepare("SELECT id FROM calls LIMIT 1").get().id);
  setBudget(db,'buyer',{capMicro:10_000});
  assert.throws(()=>reserve(db,request('d')),e=>e.code===-32004);assertLedger(db);
});
test('monthly account and per-tool caps respect UTC month boundaries', t => {
  const db=fixture();t.after(()=>db.close());
  db.prepare("UPDATE accounts SET monthly_cap_micro=20000 WHERE id='buyer'").run();
  const a=reserve(db,request('a',{at:'2026-10-31T23:59:59.000Z'}));settle(db,a.call.id,{});
  setBudget(db,'buyer',{capMicro:10_000,toolId:'extract-entities'});
  assert.throws(()=>reserve(db,request('b',{at:'2026-10-31T23:59:59.999Z'})),e=>e.code===-32004);
  reserve(db,request('c',{at:'2026-11-01T00:00:00.000Z'}));assertLedger(db);
});
test('tool errors release funds and retries do not execute or bill again', t => {
  const db=fixture();t.after(()=>db.close());let executions=0;
  const handlers={extract_entities(){executions++;throw new Error('failure drill');}};
  assert.throws(()=>callTool(db,request(),handlers));
  assert.throws(()=>callTool(db,request(),handlers));assert.equal(executions,1);
  assert.equal(db.prepare('SELECT status FROM calls').get().status,'RELEASED');assertLedger(db);
});
test('settlement rollback leaves no partial buyer debit or author credit', t => {
  const db=fixture();t.after(()=>db.close());const a=reserve(db,request());
  db.exec("CREATE TRIGGER fail_settlement BEFORE INSERT ON events WHEN NEW.kind='call.settled' BEGIN SELECT RAISE(ABORT,'injected fault'); END");
  assert.throws(()=>settle(db,a.call.id,{}),/injected fault/);
  assert.equal(db.prepare('SELECT status FROM calls').get().status,'RESERVED');assertLedger(db);
  release(db,a.call.id);release(db,a.call.id);assertLedger(db);
});
test('restart recovery releases uncompleted reservations without charging', t => {
  const db=fixture();t.after(()=>db.close());reserve(db,request());recoverReservations(db);assertLedger(db);
  assert.equal(db.prepare('SELECT status FROM calls').get().status,'RELEASED');
});
test('invalid schema inputs and provider keys cannot spend', t => {
  const db=fixture();t.after(()=>db.close());
  assert.throws(()=>callTool(db,request('a',{args:{text:2}})),e=>e.code===-32602);
  assert.throws(()=>reserve(db,request('b',{accountId:'author'})),e=>e.code===-32001);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM calls').get().n,0);
});
