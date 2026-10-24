import { api,dollars,notice } from './app.js';

/** Optional AG Studio integration. Nothing is imported until a licence is supplied. */
export async function enableStudio({licenseKey,data}) {
  const ag=await import('https://cdn.jsdelivr.net/npm/ag-studio@3.0.0/+esm');
  ag.AgStudioLicenseManager.setLicenseKey(licenseKey);
  ag.AgStudioModuleRegistry.registerModules([ag.AgStudioAiModule]);
  const base=ag.createWidgets({});
  const valueDefinition=base.widgets.find(w=>w.id==='value');
  class ReceiptWidget {
    constructor(){this.element=document.createElement('div');this.element.style.cssText='padding:24px;height:100%;display:flex;flex-direction:column;justify-content:center';}
    getGui(){return this.element;}
    init(params){return this.refresh(params);}
    async refresh(params){
      const fields=params.dataMapping.value;
      if(!fields?.length){params.widgetApi.setDisplayState('incompleteDataMapping');return;}
      params.widgetApi.setDisplayState('loading');
      const response=await params.widgetApi.getData({fields});
      const row=response.results.rows[0]||{};
      const entry=Object.entries(row).find(([key,value])=>key.includes(fields[0].id)&&Number.isSafeInteger(value));
      const amount=entry?.[1]||0;
      this.element.replaceChildren();const label=document.createElement('span');label.className='eyebrow';label.textContent='SETTLED TOOL SPEND';const value=document.createElement('strong');value.className='money';value.style.cssText='font-size:38px;font-weight:500;margin-top:15px';value.textContent=dollars(amount);const note=document.createElement('small');note.textContent='Integer micro-USD · failed calls excluded';this.element.append(label,value,note);params.widgetApi.setDisplayState('displayed');
    }
    destroy(){this.element.remove();}
  }
  const custom={id:'metered-receipt',label:'Metered receipt',dataMapping:{value:{type:'field',supportedRoles:['numeric'],requires:{cardinality:'one'},required:true}},formatShape:valueDefinition.formatShape,form:params=>params.createDefaults({dataMappingItems:[{key:'value',label:'Amount (micro-USD)'}]}),comp:ReceiptWidget,defaultSize:{width:400,height:250},minSize:{width:240,height:160},ai:{description:'Displays settled tool spend as an exact USD receipt. Map usage.spend_micro, aggregated by sum.'}};
  let harness;let studio;
  const emitMessage=async function*(input,text){const messageId=crypto.randomUUID();yield {type:'TEXT_MESSAGE_START',messageId,role:'assistant'};yield {type:'TEXT_MESSAGE_CONTENT',messageId,delta:text};yield {type:'TEXT_MESSAGE_END',messageId};};
  async function* invoke(input,ctx,name,args){
    const tool=ctx.tools().find(t=>t.name===name);if(!tool?.execute)throw new Error(`Studio tool unavailable: ${name}`);
    const toolCallId=crypto.randomUUID();yield {type:'TOOL_CALL_START',toolCallId,toolCallName:name};yield {type:'TOOL_CALL_ARGS',toolCallId,delta:JSON.stringify(args)};yield {type:'TOOL_CALL_END',toolCallId};
    const result=await tool.execute({toolCallId,name,args},ag.createAiToolContext({signal:ctx.signal,run:{threadId:input.threadId,runId:input.runId}}));
    yield {type:'TOOL_CALL_RESULT',toolCallId,messageId:crypto.randomUUID(),content:result.success?result.response:result.issues.map(i=>i.message).join('; '),role:'tool'};
    if(!result.success)throw new Error(result.issues.map(i=>i.message).join('; '));
  }
  const source=latest=>({sources:[{id:'usage',data:latest.analytics.map(r=>({...r,spend_micro:r.status==='SETTLED'?r.spend_micro:0,author_micro:r.status==='SETTLED'?r.author_micro:0,released_calls:r.status==='RELEASED'?r.calls:0}))}]});
  document.querySelector('#studio-panel').hidden=false;
  studio=ag.createStudio(document.querySelector('#ag-studio'),{
    mode:'edit',data:source(data),theme:ag.studioTheme.withParams({accentColor:'#156e5d',backgroundColor:'#ffffff',foregroundColor:'#172c2b',borderColor:'#dce4e1',fontFamily:'system-ui'}),
    widgets:()=>ag.createWidgets({additionalTypes:[custom],menu:[...base.menu,{label:'AgentMeter',widgetIds:['metered-receipt']}]}),
    initialState:{pages:[{id:'usage',widgets:{receipt:{type:'metered-receipt',dataMapping:{value:[{id:'usage.spend_micro',aggregation:'sum'}]}}},widgetLayout:{receipt:{xTrack:0,yTrack:0,xSpan:12,ySpan:12}}}],selectedPageId:'usage',panels:{filters:{collapsed:true},ai:{collapsed:false}}},
    ai:({api:studioApi})=>{
      harness=ag.createAiHarness(studioApi,({builtIn,tools})=>({
        primary:'metering-analyst',
        agents:[{
          id:'metering-analyst',name:'Metering analyst',description:'Validated usage intent planner; delegates layout to Studio’s Page agent.',tools:()=>[tools.delegateTo(['page'])],
          async *run(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{const text=[...input.messages].reverse().find(m=>m.role==='user')?.content||'Show daily spend';const intent=await api('/api/widget',{text});yield* invoke(input,ctx,'delegate_to',{type:{id:'page'},instructions:JSON.stringify(intent)});yield* emitMessage(input,`Created ${intent.title.toLowerCase()}. Intent source: ${intent.source}. Ledger amounts were not changed.`);yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};}catch(e){yield {type:'RUN_ERROR',message:e.message};}}
        },{
          ...builtIn.page,
          async *run(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{const intent=JSON.parse([...input.messages].reverse().find(m=>m.role==='user').content);const widgetId='usage-'+crypto.randomUUID().slice(0,8);const existing=studioApi.getState().pages.find(p=>p.id==='usage');const yTrack=Math.max(12,...Object.values(existing.widgetLayout||{}).map(r=>r.yTrack+r.ySpan));yield* invoke(input,ctx,'add_widget',{widgetId,type:'column-chart-grouped',xTrack:0,yTrack,xSpan:24,ySpan:16});const state=studioApi.getState();const today=new Date().toISOString().slice(0,10);const filters=[{field:{id:'usage.day'},model:{operator:'lessThanOrEqual',value:today}}];if(intent.period!=='all')filters.push({field:{id:'usage.day'},model:{operator:'greaterThanOrEqual',value:intent.period==='month'?today.slice(0,7)+'-01':new Date(Date.now()-30*86400000).toISOString().slice(0,10)}});if(intent.tool_name)filters.push({field:{id:'usage.tool_name'},model:{operator:'equals',value:intent.tool_name}});const field=`usage.${intent.metric}`;studioApi.setState({...state,pages:state.pages.map(p=>p.id!=='usage'?p:{...p,filter:{...p.filter,widget:{...p.filter?.widget,[widgetId]:filters}},widgets:{...p.widgets,[widgetId]:{type:'column-chart-grouped',dataMapping:{categoryKey:[{id:'usage.'+intent.group_by}],valueKey:[{id:field,aggregation:'sum'}]},format:{title:{text:intent.title+' (micro-USD for amounts)'}}}}})});if(ctx.completeTask?.execute)await ctx.completeTask.execute({toolCallId:crypto.randomUUID(),name:ctx.completeTask.name,args:{summary:`Added ${intent.title} using a Studio chart and the live usage source.`,artifacts:[{id:widgetId,type:'widget',description:intent.title}]}},ag.createAiToolContext({signal:ctx.signal,run:{threadId:input.threadId,runId:input.runId}}));yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};}catch(e){yield {type:'RUN_ERROR',message:e.message};}}
        }],promptStarters:[{label:'Daily spend',prompt:'Show daily spend this month'},{label:'Calls by tool',prompt:'Show calls by tool'}]
      }));return harness;
    }
  });
  document.querySelector('#studio-status').textContent='AG Studio active · receipt widget · editable layout · custom analyst delegates to Studio Page agent.';
  return {update(latest){studio.setProperty('data',source(latest));},async request(text){const session=await harness.createThread({agentId:'metering-analyst'});await session.sendMessage(text);},destroy(){studio.destroy();}};
}
