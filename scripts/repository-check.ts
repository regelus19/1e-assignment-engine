import assert from 'node:assert/strict';
import { SharePointOperationalRepository } from '../src/services/repository/SharePointOperationalRepository';
import { RepositoryConflictError } from '../src/services/repository/types';
import { CurrentShiftState, FinalizedShiftSnapshot, PlanningWorkspace } from '../src/types';

type Item = { id:string; '@odata.etag':string; lastModifiedDateTime:string; fields:Record<string,unknown> };
const items = new Map<string,Item>();
let nextId=1;
const now=()=>new Date().toISOString();

const bodyJson=(init?:RequestInit)=>init?.body ? JSON.parse(String(init.body)) : {};
const mockFetch:typeof fetch = async (input,init={})=>{
  const url=new URL(String(input));
  const path=url.pathname;
  const itemMatch=path.match(/\/items\/(\d+)(?:\/fields)?$/);
  if(init.method==='POST'&&path.endsWith('/items')){
    const fields=bodyJson(init).fields as Record<string,unknown>;
    const item:Item={id:String(nextId++),'@odata.etag':'"1"',lastModifiedDateTime:now(),fields};items.set(item.id,item);
    return Response.json(item,{status:201});
  }
  if(init.method==='PATCH'&&itemMatch){
    const item=items.get(itemMatch[1])!;
    const expected=new Headers(init.headers).get('If-Match');
    if(expected&&expected!==item['@odata.etag']&&expected!=='*')return new Response('',{status:412});
    item.fields={...item.fields,...bodyJson(init)};item['@odata.etag']=`"${Number(item['@odata.etag'].replace(/\D/g,''))+1}"`;item.lastModifiedDateTime=now();
    return Response.json(item.fields);
  }
  if((!init.method||init.method==='GET')&&itemMatch){
    const item=items.get(itemMatch[1]);return item?Response.json(item):new Response('',{status:404});
  }
  if((!init.method||init.method==='GET')&&path.endsWith('/items')){
    const filter=decodeURIComponent(url.searchParams.get('$filter')||'');
    let value=[...items.values()];
    const title=filter.match(/fields\/Title eq '(.+)'/);const unit=filter.match(/fields\/UnitId eq '(.+)'/);
    if(title)value=value.filter(i=>i.fields.Title===title[1].replace(/''/g,"'"));
    if(unit)value=value.filter(i=>i.fields.UnitId===unit[1].replace(/''/g,"'"));
    return Response.json({value});
  }
  return new Response(`Unhandled ${init.method||'GET'} ${url}`,{status:500});
};

const current:CurrentShiftState={date:'2026-09-14',shiftType:'Night',roster:[],rooms:[],mtState:'MT_PRESENT',pctState:'PCT_PRESENT',onCall:{intensivist:'',cardiothoracic:'',acuteMI:'',cardiology:'',hospitalist:''},lastUpdatedAt:now()};
const plan:PlanningWorkspace={targetDate:'2026-09-15',shiftType:'Day',roster:[],rooms:[],mtState:'MT_PRESENT',pctState:'PCT_PRESENT',onCall:{...current.onCall},pmOnCall:{...current.onCall},currentMRS:1,projectedMRS:1,lastUpdatedAt:now()};
const repo=new SharePointOperationalRepository({siteId:'site',operationalListId:'ops',historyListId:'history',getAccessToken:async()=> 'test-token',fetchImpl:mockFetch});

const liveSaved=await repo.saveCurrentShift(current);
assert.equal(liveSaved.data.date,current.date);
assert.ok(liveSaved.metadata.etag,'live save returns ETag');
const liveLoaded=await repo.loadCurrentShift('1E',current.date,current.shiftType);
assert.equal(liveLoaded.data.shiftType,'Night');

const planSaved=await repo.savePlanningWorkspace(plan);
assert.equal(planSaved.data.targetDate,plan.targetDate);
const baseline={id:'baseline-1',date:plan.targetDate,shiftType:plan.shiftType,finalizedAt:now(),savedAt:now(),roster:[],rooms:[],onCall:{...current.onCall},pmOnCall:{...current.onCall},fitScore:100,warnings:[],mtState:'MT_PRESENT' as const,pctState:'PCT_PRESENT' as const,currentMRS:1,projectedMRS:1};
await repo.savePlanBaseline(baseline);
assert.equal((await repo.loadPlanBaseline('1E',plan.targetDate,plan.shiftType)).data?.id,'baseline-1');

const stale=planSaved.metadata.etag;
const planItem=[...items.values()].find(i=>i.fields.StateType==='Plan')!;
planItem['@odata.etag']='"99"';
let conflicted=false;
try{await repo.savePlanningWorkspace({...plan,projectedMRS:1.1},stale);}catch(error){conflicted=error instanceof RepositoryConflictError;}
assert.equal(conflicted,true,'stale ETag produces typed conflict');

const snapshot:FinalizedShiftSnapshot={id:'actual-1',date:current.date,shiftType:current.shiftType,finalizedAt:now(),roster:[],rooms:[],onCall:{...current.onCall},fitScore:100,warnings:[],mtState:'MT_PRESENT',pctState:'PCT_PRESENT',currentMRS:1,projectedMRS:1};
await repo.saveFinalizedShift(snapshot);
const history=await repo.loadHistory('1E');
assert.equal(history.data.length,1);
assert.equal(history.data[0].id,'actual-1');

console.log('Repository checks passed: live/plan serialization, baseline sharing, ETag conflict rejection, history append/retrieval.');
