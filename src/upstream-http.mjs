import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import http from 'node:http';
import { StringDecoder } from 'node:string_decoder';

export function publicAddress(address) {
  if(isIP(address)===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if(isIP(address)===6&&!address.includes('.')){
    const parts=address.toLowerCase().split(':'),first=parseInt(parts[0]||'0',16),second=parseInt(parts[1]||'0',16);
    return first>=0x2000&&first<=0x3fff&&first!==0x2002&&!(first===0x2001&&(second<=0x1ff||second===0xdb8));
  }
  return false;
}
export function endpointUrl(value,{allowLoopback=false,base}={}) {
  let url;try{url=new URL(value);}catch{throw Error('Enter a valid upstream URL');}
  const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  const local=allowLoopback&&url.protocol==='http:'&&host==='127.0.0.1';
  if(!local&&(url.protocol!=='https:'||url.port&&url.port!=='443'))throw Error('Upstreams require HTTPS on port 443');
  if(url.username||url.password||url.hash||url.search)throw Error('Put authentication in the secret field, not in the URL; query strings and fragments are unsupported');
  if(!local&&(/(^|\.)(localhost|local|internal|invalid|test|onion)$/.test(host)||host.endsWith('.')||/(^|\.)paypal\.com$/.test(host)))throw Error('This upstream host is not allowed');
  if(isIP(host)&&!local&&!publicAddress(host))throw Error('Private, reserved and metadata addresses are not allowed');
  if(base&&url.origin===new URL(base).origin&&!['/examples/invoice-api','/examples/invoice-mcp'].includes(url.pathname))throw Error('Use a provider endpoint, not an AgentMeter management or metering route');
  return url;
}
function aborted(signal,work) {
  signal.throwIfAborted();let rejectAbort;
  const cancel=new Promise((_,reject)=>{rejectAbort=()=>reject(Error('Upstream deadline exceeded'));signal.addEventListener('abort',rejectAbort,{once:true});});
  return Promise.race([work,cancel]).finally(()=>signal.removeEventListener('abort',rejectAbort));
}
export async function resolveEndpoint(value,{allowLoopback=false,base,signal=AbortSignal.timeout(10000),resolve=dnsLookup}={}) {
  const url=endpointUrl(value,{allowLoopback,base}),host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await aborted(signal,resolve(host,{all:true,verbatim:true}));
  if(!addresses.length||addresses.some(r=>!(allowLoopback&&url.protocol==='http:'&&r.address==='127.0.0.1')&&!publicAddress(r.address)))throw Error('Upstream DNS resolved to a private or reserved address');
  const target=addresses.find(r=>r.family===4)||addresses[0];
  // The socket uses this exact vetted address; there is no second DNS lookup.
  const lookup=(_hostname,options,callback)=>options.all?callback(null,[target]):callback(null,target.address,target.family);
  return {url,target,lookup};
}
export async function upstreamJson(value,body,{signal=AbortSignal.timeout(10000),headers={},rpcId,notification=false,method='POST',...network}={}) {
  const {url,target,lookup}=await resolveEndpoint(value,{...network,signal});
  const payload=Buffer.from(body===undefined?'':JSON.stringify(body));if(payload.length>32768)throw Error('Upstream request is too large');
  return new Promise((resolve,reject)=>{
    let done=false;const finish=(error,result)=>{if(done)return;done=true;error?reject(error):resolve(result);};
    const request=(url.protocol==='https:'?https:http).request(url,{method,agent:false,lookup,family:target.family,signal,
      headers:{'Content-Type':'application/json',Accept:rpcId===undefined?'application/json':'application/json, text/event-stream','Content-Length':payload.length,...headers}},response=>{
      const session=response.headers['mcp-session-id'];
      if(session!==undefined&&(typeof session!=='string'||!/^[\x21-\x7e]{1,200}$/.test(session))){response.destroy();finish(Error('Invalid upstream session ID'));return;}
      const wrap=json=>({json,session});
      if(response.statusCode<200||response.statusCode>=300){response.destroy();finish(Error('Upstream returned HTTP '+response.statusCode));return;}
      if(notification){response.destroy();finish(null,wrap(null));return;}
      const stream=String(response.headers['content-type']||'').startsWith('text/event-stream');
      if(!stream&&!String(response.headers['content-type']||'').startsWith('application/json')){response.destroy();finish(Error('Upstream must return JSON or MCP event-stream'));return;}
      if(stream&&rpcId===undefined){response.destroy();finish(Error('HTTP API must return JSON'));return;}
      let bytes=0,text='';const decoder=new StringDecoder('utf8');
      const event=message=>{
        if(message?.method&&message.id!==undefined)throw Error('Interactive upstream MCP requests are not supported');
        if(message?.id!==rpcId)return false;
        if(message.jsonrpc!=='2.0'||message.error||!Object.hasOwn(message,'result'))throw Error('Upstream MCP request failed');
        finish(null,wrap(message));response.destroy();return true;
      };
      response.on('data',chunk=>{
        bytes+=chunk.length;if(bytes>131072){response.destroy();finish(Error('Upstream response exceeds 128 KB'));return;}
        text+=decoder.write(chunk);
        if(stream)try{
          let end;
          text=text.replaceAll('\r\n','\n');
          while((end=text.indexOf('\n\n'))>=0){const frame=text.slice(0,end);text=text.slice(end+2);const data=frame.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(data&&event(JSON.parse(data)))return;}
        }catch{response.destroy();finish(Error('Invalid upstream MCP event'));}
      });
      response.on('end',()=>{if(done)return;try{
        if(stream)throw Error('Upstream stream ended without a result');
        const result=JSON.parse(text+decoder.end());
        if(rpcId!==undefined){if(!event(result))throw Error('Upstream MCP response ID mismatch');}
        else finish(null,wrap(result));
      }catch(error){finish(Error(error.message==='Upstream MCP response ID mismatch'?error.message:'Invalid upstream JSON response'));}});
      response.on('error',()=>finish(Error('Upstream response failed')));
      response.on('aborted',()=>finish(Error('Upstream response interrupted')));
    });
    request.on('error',()=>finish(Error(signal.aborted?'Upstream deadline exceeded':'Upstream connection failed')));request.end(payload);
  });
}
