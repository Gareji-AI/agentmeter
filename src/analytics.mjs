import { MeteringError } from './metering.mjs';

export function widgetIntent(text,tools=[]) {
  if(typeof text!=='string'||!text.trim()||text.length>500)throw new MeteringError(-32602,'Describe spend, calls, failures, or author earnings');
  const lower=text.toLowerCase();
  const metric=/fail|releas/.test(lower)?'released_calls':/earn|author|revenue/.test(lower)?'author_micro':/spend|cost|bill/.test(lower)?'spend_micro':/call|usage|volume/.test(lower)?'calls':null;
  if(!metric)throw new MeteringError(-32602,'Try: Show daily spend this month, Calls by tool, or Failures by day');
  const named=tools.filter(tool=>[tool.name,tool.slug,tool.name.replaceAll('_',' ')].some(name=>lower.includes(name)));
  if(named.length>1)throw new MeteringError(-32602,'Choose at most one tool per widget');
  const group_by=/day|daily|trend/.test(lower)?'day':'tool_name';
  const period=/this month/.test(lower)?'month':/all time/.test(lower)?'all':'30days';
  return {metric,group_by,period,tool_name:named[0]?.name||null,title:`${{spend_micro:'Spend',author_micro:'Author earnings',calls:'Calls',released_calls:'Released calls'}[metric]} by ${group_by==='day'?'day':'tool'}`,source:'validated rule parser'};
}

export function widgetRows(rows,intent,at=new Date().toISOString()) {
  const grouped=new Map();const end=at.slice(0,10);const start=new Date(new Date(at).getTime()-30*86400000).toISOString().slice(0,10);
  for(const row of rows){
    if(row.day>end||intent.period==='month'&&row.day.slice(0,7)!==at.slice(0,7)||intent.period==='30days'&&row.day<start||intent.tool_name&&row.tool_name!==intent.tool_name)continue;
    const key=row[intent.group_by];
    const value=intent.metric==='released_calls'?(row.status==='RELEASED'?row.calls:0):intent.metric==='calls'?row.calls:row.status==='SETTLED'?row[intent.metric]:0;
    grouped.set(key,(grouped.get(key)||0)+value);
  }
  return [...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([label,value])=>({label,value}));
}
