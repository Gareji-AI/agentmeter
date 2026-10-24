import { state,api,notice,rowsTable,dollars } from './app.js';
const $=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const boot=JSON.parse($('#boot').textContent);
let widgets=[];try{widgets=JSON.parse(localStorage.getItem('agentmeter.widgets.v1')||'[]').filter(w=>w&&['calls','spend_micro','author_micro','released_calls'].includes(w.metric)&&['day','tool_name'].includes(w.group_by)).slice(0,6);}catch{}
let latest=state;let gridApi;let studio;
function values(intent){const map=new Map();const today=new Date().toISOString().slice(0,10);const start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);for(const r of latest.analytics){if(r.day>today||intent.period==='month'&&r.day.slice(0,7)!==today.slice(0,7)||intent.period==='30days'&&r.day<start||intent.tool_name&&r.tool_name!==intent.tool_name)continue;const key=r[intent.group_by];const n=intent.metric==='released_calls'?(r.status==='RELEASED'?r.calls:0):intent.metric==='calls'?r.calls:r.status==='SETTLED'?r[intent.metric]:0;map.set(key,(map.get(key)||0)+n);}return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([label,value])=>({label,value}));}
function renderWidgets(){const target=$('#analytics-widgets');target.replaceChildren();for(const [i,intent]of widgets.entries()){
  const rows=values(intent);const total=rows.reduce((n,r)=>n+r.value,0);const maximum=rows.reduce((n,r)=>Math.max(n,r.value),1);const currency=intent.metric.endsWith('_micro');
  const section=document.createElement('section');section.className='panel';
  section.innerHTML=`<div class="panel-head"><div><h2>${h(intent.title)}</h2><p>${h(intent.period)}${intent.tool_name?' · '+h(intent.tool_name):''}</p></div><button class="text-button" aria-label="Remove ${h(intent.title)}">×</button></div><div class="widget-total money">${currency?dollars(total):total}</div><div class="widget-bars" role="img" aria-label="${h(intent.title)}: ${h(rows.map(r=>r.label+' '+(currency?dollars(r.value):r.value)).join(', '))}">${rows.map(r=>`<span title="${h(r.label)}: ${currency?dollars(r.value):r.value}" style="height:${Number(BigInt(r.value)*100n/BigInt(maximum))}%"></span>`).join('')}</div><p class="footnote">${h(intent.source||'validated rule parser')} · drag with the buttons below</p><div class="actions"><button class="text-button" data-move="up">Move left</button><button class="text-button" data-move="down">Move right</button></div>`;
  section.querySelector('[aria-label]')?.addEventListener('click',()=>{widgets.splice(i,1);save();renderWidgets();});
  for(const button of section.querySelectorAll('[data-move]'))button.addEventListener('click',()=>{const j=button.dataset.move==='up'?Math.max(0,i-1):Math.min(widgets.length-1,i+1);[widgets[i],widgets[j]]=[widgets[j],widgets[i]];save();renderWidgets();});target.append(section);
}}
function save(){try{localStorage.setItem('agentmeter.widgets.v1',JSON.stringify(widgets));}catch{}}
$('#widget-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{
  const text=new FormData(event.target).get('text');const intent=await api('/api/widget',{text});if(widgets.length>=6)widgets.shift();widgets.push(intent);save();renderWidgets();
  if(studio)await studio.request(text);
  notice(`Created ${intent.title.toLowerCase()} · ${intent.source}`);
}catch(e){notice(e.message);}finally{button.disabled=false;}});
$('#export-csv').addEventListener('click',event=>{event.preventDefault();const keys=['day','tool_name','status','calls','spend_micro','author_micro'];const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[keys.map(quote).join(','),...latest.analytics.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='agentmeter-usage-micro-usd.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

async function enableGrid(){
  if(!boot.gridLicense&&!boot.studioLicense){$('#studio-status').textContent='Plain table mode · no licence configured. Widgets and CSV export remain available.';return;}
  try{
    const ag=await import('https://cdn.jsdelivr.net/npm/ag-grid-community@36.2.0/+esm');
    ag.ModuleRegistry.registerModules([ag.AllCommunityModule]);
    const StatusCell=params=>{const span=document.createElement('span');span.className='status '+String(params.value).toLowerCase();span.textContent=params.value;return span;};
    const moneyCell=params=>{const span=document.createElement('span');span.className='money';span.textContent=dollars(params.value);return span;};
    $('#ag-grid').hidden=false;
    gridApi=ag.createGrid($('#ag-grid'),{theme:ag.themeQuartz.withParams({accentColor:'#156e5d',backgroundColor:'#ffffff',foregroundColor:'#172c2b',headerBackgroundColor:'#f4f6f5',borderColor:'#dce4e1',fontFamily:'system-ui',fontSize:12,spacing:6}),rowData:latest.analytics,defaultColDef:{sortable:true,filter:true,resizable:true,flex:1,minWidth:110},columnDefs:[{field:'day',headerName:'Day (UTC)'},{field:'tool_name',headerName:'Tool',minWidth:180},{field:'status',cellRenderer:StatusCell},{field:'calls'},{field:'spend_micro',headerName:'Spend (USD)',cellRenderer:moneyCell,valueGetter:p=>p.data.status==='SETTLED'?p.data.spend_micro:0},{field:'author_micro',headerName:'Author (USD)',cellRenderer:moneyCell,valueGetter:p=>p.data.status==='SETTLED'?p.data.author_micro:0}],pagination:true,paginationPageSize:25,paginationPageSizeSelector:[25,50,100]});
    $('#analytics-table').hidden=true;
    $('#studio-status').textContent='AG Grid active · custom state and money cells · themed to AgentMeter.';
    if(boot.studioLicense){const module=await import('./studio.js');studio=await module.enableStudio({licenseKey:boot.studioLicense,data:latest});}
  }catch(e){$('#ag-grid').hidden=true;$('#analytics-table').hidden=false;$('#studio-panel').hidden=true;$('#studio-status').textContent='Analytics library unavailable. Plain table mode remains fully usable.';}
}
window.addEventListener('agentmeter:state',event=>{latest=event.detail;renderWidgets();gridApi?.setGridOption('rowData',latest.analytics);studio?.update(latest);});
if(!widgets.length)widgets=[{metric:'spend_micro',group_by:'day',period:'month',tool_name:null,title:'Spend by day',source:'validated rule parser'}];
renderWidgets();enableGrid();

$('#classify-tools')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;try{const result=await api('/api/classify',{});$('#tool-clusters').innerHTML=rowsTable(['Tool','Semantic category'],result.clusters.map(r=>[h(r.tool_name),h(r.category)]));notice(result.source);}catch(e){notice(e.message);}finally{$('#classify-tools').disabled=false;}});
