import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkedBudget,checkedWidget,interpretWidget,narrate } from '../src/ai.mjs';
test('untrusted model output cannot invent budget amounts, tools or analytics fields',()=>{
  const tools=[{id:'tool',name:'extract_entities',slug:'extract-entities'}];
  assert.throws(()=>checkedBudget({amount:'500',scope:'monthly',tool_name:'extract_entities'},'Keep extract_entities under $0.50 this month',tools));
  assert.throws(()=>checkedWidget({metric:'DROP TABLE',group_by:'day',period:'all',tool_name:null},tools));
  assert.throws(()=>checkedBudget({amount:'0.50',scope:'monthly',tool_name:null},'Keep extract_entities under $0.50 this month for overall safety',tools));
  assert.throws(()=>checkedBudget({amount:'0.50',scope:'monthly',tool_name:'extract_entities'},'Keep all tools under $0.50 this month',tools));
  assert.equal(checkedBudget({amount:'0.50',scope:'monthly',tool_name:'extract_entities'},'Keep extract_entities under $0.50 this month',tools).capMicro,500_000);
});
test('without credentials, intent and narration remain deterministic without a network call',async()=>{
  const network=()=>{throw new Error('Network must not be called');};
  assert.equal((await interpretWidget({},'Show daily spend this month',[],network)).source,'validated rule parser');
  assert.equal((await narrate({},{calls:3,total_micro:30_000},network)).source,'deterministic planner');
});
