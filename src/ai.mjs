import { widgetIntent } from './analytics.mjs';
import { toMicro } from './money.mjs';

/** Model output is a proposal. Only whitelisted, read-only intent or bounded caps survive. */
async function generate(env,instructions,input,schema,fetcher=fetch) {
  if(!env.GEMINI_API_KEY)throw new Error('Gemini is not configured');
  const model=env.GEMINI_MODEL||'gemini-3.8-flash';
  if(!/^[a-zA-Z0-9._-]+$/.test(model))throw new Error('Invalid model id');
  const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:1024}}),signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw new Error(`Gemini unavailable (${response.status})`);
  const result=await response.json();return JSON.parse(result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}');
}
export function checkedWidget(value,tools) {
  if(!['spend_micro','author_micro','calls','released_calls'].includes(value.metric)||!['day','tool_name'].includes(value.group_by)||!['month','30days','all'].includes(value.period)||value.tool_name!==null&&!tools.some(t=>t.name===value.tool_name))throw new Error('Model returned an invalid analytics intent');
  return {metric:value.metric,group_by:value.group_by,period:value.period,tool_name:value.tool_name,title:`${{spend_micro:'Spend',author_micro:'Author earnings',calls:'Calls',released_calls:'Released calls'}[value.metric]} by ${value.group_by==='day'?'day':'tool'}`,source:'Gemini · validated intent'};
}
export async function interpretWidget(env,text,tools,fetcher=fetch) {
  if(!env.GEMINI_API_KEY)return widgetIntent(text,tools);
  if(typeof text!=='string'||text.length>500)throw new Error('Widget request is too long');
  try{
    const result=await generate(env,'Choose an analytics view from the allowed fields. Never generate code, SQL, monetary operations or tool executions. Return null for tool_name unless the user names a tool.',{request:text,tools:tools.map(t=>t.name)},{type:'object',properties:{metric:{type:'string',enum:['spend_micro','author_micro','calls','released_calls']},group_by:{type:'string',enum:['day','tool_name']},period:{type:'string',enum:['month','30days','all']},tool_name:{type:['string','null']}},required:['metric','group_by','period','tool_name']},fetcher);
    return checkedWidget(result,tools);
  }catch(error){return {...widgetIntent(text,tools),source:'validated rule parser (AI unavailable)'};}
}
export function checkedBudget(value,text,tools) {
  const literal=[...text.matchAll(/\$(\d+(?:\.\d{1,6})?)(?![\d.])/g)];
  const named=tools.filter(t=>[t.name,t.slug,t.name.replaceAll('_',' ')].filter(Boolean).some(name=>text.toLowerCase().includes(name)));
  if(value.tool_name!==null&&(named.length!==1||named[0].name!==value.tool_name)||value.tool_name===null&&named.length)throw new Error('Model changed the named budget tool');
  if(literal.length!==1||! /month/i.test(text)||value.amount!==literal[0][1]||value.scope!=='monthly'||value.tool_name===null&&!/all tools|total|overall|entire/i.test(text)||value.tool_name!==null&&!tools.some(t=>t.name===value.tool_name))throw new Error('Model budget does not match the explicit amount and scope');
  const capMicro=toMicro(value.amount);if(capMicro<0)throw new Error('Negative cap');
  return {capMicro,toolId:tools.find(t=>t.name===value.tool_name)?.id||null,sourceText:text};
}
export async function interpretBudget(env,text,tools,fallback,fetcher=fetch) {
  if(!env.GEMINI_API_KEY)return fallback();
  try{
    const value=await generate(env,'Extract a monthly USD cap from the explicit dollar amount. Preserve the exact decimal string. Choose a tool from the supplied list, or null only when the user explicitly says all tools/total/overall.',{request:text,tools:tools.map(t=>({name:t.name,description:t.description}))},{type:'object',properties:{amount:{type:'string'},scope:{type:'string',enum:['monthly']},tool_name:{type:['string','null']}},required:['amount','scope','tool_name']},fetcher);
    return checkedBudget(value,text,tools);
  }catch(error){return fallback();}
}
export async function narrate(env,facts,fetcher=fetch) {
  const fallback={text:`The planner settled ${facts.calls} tool calls for ${facts.total_micro} micro-USD. The author received the recorded credits.`,source:'deterministic planner'};
  if(!env.GEMINI_API_KEY)return fallback;
  try{const value=await generate(env,'Narrate these already-settled ledger facts in one short English sentence. Do not invent prices, amounts, payout status, model use, or actions. You cannot change the ledger.',facts,{type:'object',properties:{text:{type:'string'}},required:['text']},fetcher);if(typeof value.text!=='string'||value.text.length>600)throw new Error('Invalid narration');return {text:value.text,source:'Gemini narration'};}catch{return fallback;}
}
export async function classifySyntheticHistory(env,samples,fetcher=fetch) {
  if(!env.GEMINI_API_KEY)throw new Error('Add GEMINI_API_KEY to enable optional semantic labels');
  const result=await generate(env,'Group synthetic historical tool examples by semantic purpose. Choose extraction, transformation, or validation. Only label the named tools.',samples,{type:'object',properties:{clusters:{type:'array',items:{type:'object',properties:{tool_name:{type:'string'},category:{type:'string',enum:['extraction','transformation','validation']}},required:['tool_name','category']}}},required:['clusters']},fetcher);
  if(!Array.isArray(result.clusters)||result.clusters.length!==samples.length||new Set(result.clusters.map(r=>r.tool_name)).size!==samples.length||result.clusters.some(r=>!samples.some(s=>s.tool_name===r.tool_name)||!['extraction','transformation','validation'].includes(r.category)))throw new Error('Invalid semantic labels');
  return {...result,source:'Gemini · synthetic history only'};
}
