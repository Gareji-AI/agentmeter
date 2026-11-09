import { api,dollars,notice } from './app.js';
import { runStudioSession } from './studio-session.js';

/** Optional AG Studio integration, including the vendor's watermarked evaluation. */
export async function enableStudio({licenseKey,gridLicense,data}) {
  const ag=await import('https://cdn.jsdelivr.net/npm/ag-studio@3.0.0/+esm');
  if(gridLicense){const charts=await import('https://cdn.jsdelivr.net/npm/ag-charts-enterprise@14.2.0/+esm');charts.LicenseManager.setLicenseKey(gridLicense);}
  if(licenseKey)ag.AgStudioLicenseManager.setLicenseKey(licenseKey);
  ag.AgStudioModuleRegistry.registerModules([ag.AgStudioAiModule]);
  const base=ag.createWidgets({});
  const valueDefinition=base.widgets.find(w=>w.id==='value');
  class ReceiptWidget {
    constructor(){this.element=document.createElement('div');this.element.style.cssText='padding:16px 24px;height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px';}
    getGui(){return this.element;}
    init(params){return this.refresh(params);}
    async refresh(params){
      const refreshId=this.refreshId=Symbol();
      const fields=params.dataMapping.value;
      if(!fields?.length){params.widgetApi.setDisplayState('incompleteDataMapping');return;}
      params.widgetApi.setDisplayState('loading');
      const response=await params.widgetApi.getData({fields});
      if(this.refreshId!==refreshId)return;
      const row=response.results.rows[0];
      if(!row){params.widgetApi.setDisplayState('noData');return;}
      // Studio resolves a field to an opaque result key; it is not the source field id.
      const amount=row[fields[0].key];
      if(!Number.isSafeInteger(amount)){params.widgetApi.setDisplayState('noData');return;}
      this.element.replaceChildren();const label=document.createElement('span');label.className='eyebrow';label.style.cssText='font-size:11px;line-height:1.2;flex-shrink:0';label.textContent=fields[0].fieldId.endsWith('spend_micro')?'SETTLED TOOL SPEND':fields[0].fieldId.endsWith('author_micro')?'AUTHOR CREDITS':params.widgetApi.getFieldName(fields[0]);const value=document.createElement('strong');value.className='money';value.style.cssText='font-size:32px;font-weight:500;line-height:1.1;flex-shrink:0';value.textContent=fields[0].fieldId.endsWith('_micro')?dollars(amount):String(amount);const note=document.createElement('small');note.style.cssText='font-size:11px;line-height:1.4;flex-shrink:0';note.textContent=fields[0].fieldId.endsWith('_micro')?'Integer micro-USD · settled only · history + live':'Usage count · history + live';this.element.append(label,value,note);params.widgetApi.setDisplayState('displayed');
    }
    destroy(){this.refreshId=null;this.element.remove();}
  }
  const custom={id:'metered-receipt',label:'Metered receipt',dataMapping:{value:{type:'field',supportedRoles:['numeric'],requires:{cardinality:'one'},required:true}},formatShape:valueDefinition.formatShape,form:params=>params.createDefaults({dataMappingItems:[{key:'value',label:'Amount (micro-USD)'}]}),comp:ReceiptWidget,defaultSize:{width:400,height:250},minSize:{width:240,height:160},ai:{description:'Displays settled tool spend as an exact USD receipt. Map usage.spend_micro, aggregated by sum.'}};
  let harness;let studio;
  const emitMessage=async function*(input,text){const messageId=crypto.randomUUID();yield {type:'TEXT_MESSAGE_START',messageId,role:'assistant'};yield {type:'TEXT_MESSAGE_CONTENT',messageId,delta:text};yield {type:'TEXT_MESSAGE_END',messageId};};
  async function* invoke(input,ctx,name,args){
    const tool=name==='complete_task'?ctx.completeTask:ctx.tools().find(t=>t.name===name);if(!tool?.execute)throw new Error(`Studio tool unavailable: ${name}`);
    const toolCallId=crypto.randomUUID();yield {type:'TOOL_CALL_START',toolCallId,toolCallName:name};yield {type:'TOOL_CALL_ARGS',toolCallId,delta:JSON.stringify(args)};yield {type:'TOOL_CALL_END',toolCallId};
    const result=await tool.execute({toolCallId,name,args},ag.createAiToolContext({signal:ctx.signal,run:{threadId:input.threadId,runId:input.runId}}));
    yield {type:'TOOL_CALL_RESULT',toolCallId,messageId:crypto.randomUUID(),content:result.success?result.response:result.issues.map(i=>i.message).join('; '),role:'tool'};
    if(!result.success)throw new Error(result.issues.map(i=>i.message).join('; '));
    return result;
  }
  const source=latest=>({sources:[{id:'usage',name:'Tool usage',fields:[
    {id:'day',name:'Day (UTC)',format:'dateFormat',createValueFormatter:()=>value=>value instanceof Date?value.toISOString().slice(0,10):String(value)},
    {id:'tool_name',name:'Tool',format:'textFormat'},
    {id:'status',name:'Call state',format:'textFormat'},
    {id:'calls',name:'Calls',format:'integerFormat',createValueFormatter:()=>value=>String(value)},
    {id:'spend_micro',name:'Settled spend (USD)',format:'integerFormat',createValueFormatter:()=>dollars},
    {id:'author_micro',name:'Author credits (USD)',format:'integerFormat',createValueFormatter:()=>dollars},
    {id:'released_calls',name:'Released calls',format:'integerFormat',createValueFormatter:()=>value=>String(value)}
  ],data:latest.analytics.map(r=>({...r,day:new Date(r.day+'T00:00:00Z'),spend_micro:r.status==='SETTLED'?r.spend_micro:0,author_micro:r.status==='SETTLED'?r.author_micro:0,released_calls:r.status==='RELEASED'?r.calls:0}))}]});
  document.querySelector('#studio-panel').hidden=false;
  studio=ag.createStudio(document.querySelector('#ag-studio'),{
    mode:'edit',data:source(data),theme:ag.studioTheme.withParams({accentColor:'#156e5d',backgroundColor:'#ffffff',foregroundColor:'#172c2b',textColor:'#172c2b',subtleTextColor:'#546966',borderColor:'#dce4e1',fontFamily:'system-ui',chartPaletteFills1Color:'#156e5d',chartPaletteStrokes1Color:'#156e5d'}),
    // Chart options pass through to AG Charts. Pin display formatting for English recordings;
    // Studio's default compact formatter inherits the browser locale (for example, 万).
    widgets:()=>ag.createWidgets({overrides:[{id:'column-chart-grouped',options:{formatter:{x:({value})=>value instanceof Date?value.toISOString().slice(0,10):String(value),y:({value})=>String(value)}}}],additionalTypes:[custom],menu:[...base.menu,{label:'AgentMeter',widgetIds:['metered-receipt']}]}),
    initialState:{pages:[{id:'usage',widgets:{receipt:{type:'metered-receipt',dataMapping:{value:[{id:'usage.spend_micro',aggregation:'sum'}]}}},widgetLayout:{receipt:{xTrack:0,yTrack:0,xSpan:24,ySpan:9}}}],selectedPageId:'usage',panels:{filters:{collapsed:true},edit:{collapsed:true},data:{collapsed:true},ai:{collapsed:false,width:300}}},
    ai:({api:studioApi})=>{
      harness=ag.createAiHarness(studioApi,({builtIn,tools})=>({
        primary:'metering-analyst',
        agents:[{
          id:'metering-analyst',name:'Metering analyst',description:'Validated usage intent planner; delegates layout to Studio’s Page agent.',tools:()=>[tools.delegateTo(['page'])],
          async *run(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{const text=[...input.messages].reverse().find(m=>m.role==='user')?.content||'Show daily spend';const intent=await api('/api/widget',{text});const countBefore=Object.keys(studioApi.getState().pages.find(p=>p.id==='usage').widgets).length;yield* invoke(input,ctx,'delegate_to',{type:{id:'page'},instructions:JSON.stringify(intent)});if(Object.keys(studioApi.getState().pages.find(p=>p.id==='usage').widgets).length!==countBefore+1)throw new Error('Studio Page agent did not create a widget');yield* emitMessage(input,`Created ${intent.title.toLowerCase()}. Intent source: ${intent.source}${intent.model?' ('+intent.model+')':''}. Ledger amounts were not changed.`);yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};}catch(e){yield {type:'RUN_ERROR',message:e.message};}}
        },{
          ...builtIn.page,
          async *run(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{const intent=JSON.parse([...input.messages].reverse().find(m=>m.role==='user').content);const widgetId='usage-'+crypto.randomUUID().slice(0,8);const existing=studioApi.getState().pages.find(p=>p.id==='usage');const yTrack=Math.max(12,...Object.values(existing.widgetLayout||{}).map(r=>r.yTrack+r.ySpan));yield* invoke(input,ctx,'add_widget',{widgetId,type:'column-chart-grouped',xTrack:0,yTrack,xSpan:24,ySpan:16});const state=studioApi.getState();const today=new Date().toISOString().slice(0,10);const filters=[{field:{id:'usage.day'},model:{operator:'lessThanOrEqual',value:today}}];if(intent.period!=='all')filters.push({field:{id:'usage.day'},model:{operator:'greaterThanOrEqual',value:intent.period==='month'?today.slice(0,7)+'-01':new Date(Date.now()-30*86400000).toISOString().slice(0,10)}});if(intent.tool_name)filters.push({field:{id:'usage.tool_name'},model:{operator:'equals',value:intent.tool_name}});const field=`usage.${intent.metric}`;studioApi.setState({...state,pages:state.pages.map(p=>p.id!=='usage'?p:{...p,filter:{...p.filter,widget:{...p.filter?.widget,[widgetId]:filters}},widgets:{...p.widgets,[widgetId]:{type:'column-chart-grouped',dataMapping:{categoryKey:[{id:'usage.'+intent.group_by}],valueKey:[{id:field,aggregation:'sum'}]},sort:[{field:{id:'usage.'+intent.group_by},direction:'asc'}],format:{title:{enabled:true,text:intent.title},caption:{enabled:true,text:intent.metric.endsWith('_micro')?'Axis: integer micro-USD · tooltips: exact USD':'Counts · includes settled and released calls'},style:{custom:{valueAxis:{title:{enabled:true,text:intent.metric.endsWith('_micro')?'Micro-USD':'Calls'}}}}}}}})});if(ctx.completeTask)yield* invoke(input,ctx,'complete_task',{summary:`Added ${intent.title} using a Studio chart and the live usage source.`,artifacts:[{id:widgetId,type:'widget',description:intent.title}]});yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};}catch(e){yield {type:'RUN_ERROR',message:e.message};}}
        }],promptStarters:[{label:'Daily spend',prompt:'Show daily spend this month'},{label:'Calls by tool',prompt:'Show calls by tool'}]
      }));return harness;
    }
  });
  document.querySelector('#studio-status').textContent='AG Studio active · receipt widget · editable layout · custom analyst delegates to Studio Page agent.';
  return {update(latest){studio.setProperty('data',source(latest));},async request(text){const session=await harness.createThread({agentId:'metering-analyst'});await runStudioSession(session,text);},destroy(){studio.destroy();harness?.dispose?.();}};
}
