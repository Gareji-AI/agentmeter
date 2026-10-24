import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkedBudget,checkedWidget,interpretWidget,interpretBudget,narrate,classifySyntheticHistory } from '../src/ai.mjs';
test('untrusted model output cannot invent budget amounts, tools or analytics fields',()=>{
  const tools=[{id:'tool',name:'extract_entities',slug:'extract-entities'}];
  assert.throws(()=>checkedBudget({amount:'500',scope:'monthly',tool_name:'extract_entities'},'Keep extract_entities under $0.50 this month',tools));
  assert.throws(()=>checkedWidget({metric:'DROP TABLE',group_by:'day',period:'all',tool_name:null},tools));
  assert.throws(()=>checkedBudget({amount:'0.50',scope:'monthly',tool_name:null},'Keep extract_entities under $0.50 this month for overall safety',tools));
  assert.throws(()=>checkedBudget({amount:'0.50',scope:'monthly',tool_name:'extract_entities'},'Keep all tools under $0.50 this month',tools));
  assert.equal(checkedBudget({amount:'0.50',scope:'monthly',tool_name:'extract_entities'},'Keep extract_entities under $0.50 this month',tools).capMicro,500_000);
});

const completion=(value,extra={})=>new Response(JSON.stringify({modelVersion:'gemini-fixture',candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning is not output'},{text:JSON.stringify(value)}]}}],...extra}),{status:200});
test('structured Gemini output records the provider model and sends only the request and tool names',async()=>{
  let request;let endpoint;
  const fetcher=async(url,options)=>{endpoint=url;request=options;return completion({metric:'spend_micro',group_by:'day',period:'month',tool_name:null});};
  const intent=await interpretWidget({GEMINI_API_KEY:'fixture-key'},'Plot what I paid each calendar day during the current month.',[{name:'extract_entities',api_key:'never-send',balance_micro:123}],fetcher);
  assert.equal(intent.source,'Gemini · validated intent');assert.equal(intent.model,'gemini-fixture');
  assert.equal(intent.metric,'spend_micro');assert.equal(intent.period,'month');
  assert.match(endpoint,/\/models\/gemini-3\.5-flash-lite:generateContent$/);assert.ok(!endpoint.includes('fixture-key'));
  assert.equal(request.headers['x-goog-api-key'],'fixture-key');
  assert.ok(!request.body.includes('never-send'));assert.ok(!request.body.includes('balance_micro'));
  const payload=JSON.parse(request.body);assert.equal(payload.generationConfig.responseMimeType,'application/json');assert.equal(payload.generationConfig.responseJsonSchema.type,'object');
});
test('provider failures, truncated completions and invalid model intent cannot masquerade as Gemini success',async()=>{
  const request='Show daily spend this month';
  const cases=[()=>new Response('{}',{status:429}),()=>completion({metric:'calls',group_by:'day',period:'month',tool_name:null},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"metric":"calls"}'}]}}]}),()=>completion({metric:'execute_payout',group_by:'day',period:'month',tool_name:null})];
  for(const fetcher of cases){const result=await interpretWidget({GEMINI_API_KEY:'fixture'},request,[],fetcher);assert.match(result.source,/rule parser/);assert.equal(result.model,undefined);assert.equal(result.metric,'spend_micro');}
});
test('structured response metadata preserves budget, narration and synthetic classification adapters',async()=>{
  const env={GEMINI_API_KEY:'fixture'};const tools=[{id:'entities',name:'extract_entities'}];
  const budget=await interpretBudget(env,'Keep extract_entities under $0.50 this month',tools,()=>{throw Error('Unexpected fallback');},()=>completion({amount:'0.50',scope:'monthly',tool_name:'extract_entities'}));assert.equal(budget.capMicro,500_000);
  assert.equal((await narrate(env,{calls:3,total_micro:30_000},()=>completion({text:'Three calls settled.'}))).source,'Gemini narration');
  assert.equal((await classifySyntheticHistory(env,[{tool_name:'extract_entities'}],()=>completion({clusters:[{tool_name:'extract_entities',category:'extraction'}]}))).source,'Gemini · synthetic history only');
});
test('without credentials, intent and narration remain deterministic without a network call',async()=>{
  const network=()=>{throw new Error('Network must not be called');};
  assert.equal((await interpretWidget({},'Show daily spend this month',[],network)).source,'validated rule parser');
  assert.equal((await narrate({},{calls:3,total_micro:30_000},network)).source,'deterministic planner');
});
