import { MeteringError,canonical } from './metering.mjs';
const invalid=message=>{throw new MeteringError(-32602,message);};
const types=new Set(['object','array','string','number','integer','boolean','null']);
const allowed=new Set(['type','properties','required','additionalProperties','items','description','title','enum','minLength','maxLength','minimum','maximum','minItems','maxItems']);
export function checkSchema(schema,depth=0) {
  if(depth>6||!schema||typeof schema!=='object'||Array.isArray(schema)||!types.has(schema.type))invalid('Use the supported JSON Schema subset (explicit type, properties, required, items and bounds)');
  for(const key of Object.keys(schema))if(!allowed.has(key))invalid('Unsupported schema keyword: '+key);
  for(const key of ['title','description'])if(schema[key]!==undefined&&(typeof schema[key]!=='string'||schema[key].length>1000))invalid('Schema text is too long');
  for(const key of ['minLength','maxLength','minItems','maxItems'])if(schema[key]!==undefined&&(!Number.isSafeInteger(schema[key])||schema[key]<0||schema[key]>16384))invalid('Invalid schema length bound');
  for(const key of ['minimum','maximum'])if(schema[key]!==undefined&&(typeof schema[key]!=='number'||!Number.isFinite(schema[key])))invalid('Invalid numeric bound');
  if(schema.enum!==undefined&&(!Array.isArray(schema.enum)||!schema.enum.length||schema.enum.length>50||schema.enum.some(v=>v!==null&&typeof v==='object')))invalid('Use at most 50 scalar enum values');
  if(schema.type==='object') {
    const properties=schema.properties||{};
    if(typeof properties!=='object'||!properties||Array.isArray(properties)||Object.keys(properties).length>30)invalid('Use at most 30 object properties');
    if(schema.required!==undefined&&(!Array.isArray(schema.required)||schema.required.some(k=>typeof k!=='string'||!Object.hasOwn(properties,k))))invalid('Required fields must exist in properties');
    if(schema.additionalProperties!==undefined&&typeof schema.additionalProperties!=='boolean')invalid('additionalProperties must be a boolean');
    for(const [key,child] of Object.entries(properties)){if(key.length>80||['_request_id','_max_price_micro','__proto__','constructor','prototype'].includes(key))invalid('Reserved schema property');checkSchema(child,depth+1);}
  }
  if(schema.type==='array'){if(!schema.items)invalid('Arrays need items');checkSchema(schema.items,depth+1);}
  if(depth===0&&(schema.type!=='object'||JSON.stringify(schema).length>16000))invalid('Use an object schema under 16 KB');
  return schema;
}
export function validateRemoteArgs(schema,value,depth=0,path='arguments') {
  if(depth>6)invalid('Arguments are too deeply nested');
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  if(schema.type==='integer'?!Number.isSafeInteger(value):schema.type!==type)invalid('Invalid type at '+path);
  if(schema.enum&&!schema.enum.some(v=>canonical(v)===canonical(value)))invalid('Invalid enum at '+path);
  if(type==='string'&&(value.length<(schema.minLength||0)||value.length>Math.min(schema.maxLength??16384,16384)))invalid('Invalid text length at '+path);
  if(type==='number'&&(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))invalid('Invalid number at '+path);
  if(type==='array'){
    if(value.length<(schema.minItems||0)||value.length>Math.min(schema.maxItems??100,100))invalid('Invalid array length at '+path);
    value.forEach((item,i)=>validateRemoteArgs(schema.items,item,depth+1,path+'.'+i));
  }
  if(type==='object'){
    if(Object.keys(value).length>100)invalid('Too many argument properties');
    for(const key of schema.required||[])if(!Object.hasOwn(value,key))invalid('Missing '+path+'.'+key);
    for(const [key,item] of Object.entries(value)){
      if(Object.hasOwn(schema.properties||{},key))validateRemoteArgs(schema.properties[key],item,depth+1,path+'.'+key);
      else if(schema.additionalProperties!==true)invalid('Unknown '+path+'.'+key);
      else if(JSON.stringify(item).length>16384)invalid('Argument is too large');
    }
  }
  return value;
}
