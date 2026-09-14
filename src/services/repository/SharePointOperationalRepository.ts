import {
  CurrentShiftState,
  FinalizedShiftSnapshot,
  OperationalEvent,
  PlanBaseline,
  PlanningWorkspace,
} from '../../types';
import {
  OperationalRepository,
  RepositoryConflictError,
  RepositoryMetadata,
  RepositoryResult,
  ShiftType,
} from './types';

export type AccessTokenProvider = () => Promise<string>;
export interface SharePointOperationalRepositoryConfig {
  siteId: string;
  operationalListId: string;
  historyListId: string;
  getAccessToken: AccessTokenProvider;
  unitId?: string;
  seedRepository?: OperationalRepository;
  graphBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

type GraphFields = Record<string, unknown>;
interface GraphListItem { id:string; '@odata.etag'?:string; lastModifiedDateTime?:string; fields?:GraphFields; }
interface GraphCollection<T> { value:T[]; }
interface LiveEnvelope { state:CurrentShiftState; events:OperationalEvent[]; }
interface PlanEnvelope { workspace:PlanningWorkspace; baseline:PlanBaseline|null; }

const FIELD_SELECT='Title,UnitId,StateType,PayloadJson';
const graphEscape=(value:string)=>value.replace(/'/g,"''");
const encodeIdentifier=(unitId:string,date:string,shiftType:ShiftType,stateType:'Live'|'Plan')=>`${unitId}|${date}|${shiftType}|${stateType}`;
const isLiveEnvelope=(value:unknown):value is LiveEnvelope=>!!value&&typeof value==='object'&&!!(value as LiveEnvelope).state&&Array.isArray((value as LiveEnvelope).events);
const isPlanEnvelope=(value:unknown):value is PlanEnvelope=>!!value&&typeof value==='object'&&!!(value as PlanEnvelope).workspace&&'baseline' in (value as PlanEnvelope);

export class SharePointOperationalRepository implements OperationalRepository {
  private readonly graphBaseUrl:string;
  private readonly fetchImpl:typeof fetch;
  private readonly unitId:string;
  private readonly cache=new Map<string,GraphListItem>();

  constructor(private readonly config:SharePointOperationalRepositoryConfig){
    this.graphBaseUrl=config.graphBaseUrl||'https://graph.microsoft.com/v1.0';
    this.fetchImpl=config.fetchImpl||fetch;
    this.unitId=config.unitId||'1E';
  }

  private metadata(item:GraphListItem):RepositoryMetadata{return{etag:item['@odata.etag']||'',lastModified:item.lastModifiedDateTime||new Date().toISOString(),source:'remote'};}
  private async request(path:string,init:RequestInit={}):Promise<Response>{const token=await this.config.getAccessToken();const headers=new Headers(init.headers||{});headers.set('Authorization',`Bearer ${token}`);headers.set('Accept','application/json');if(init.body)headers.set('Content-Type','application/json');return this.fetchImpl(`${this.graphBaseUrl}${path}`,{...init,headers});}
  private async json<T>(response:Response):Promise<T>{if(!response.ok){const body=await response.text().catch(()=>'');throw new Error(`Microsoft Graph request failed (${response.status}): ${body||response.statusText}`);}return response.json() as Promise<T>;}
  private async getItemById(listId:string,itemId:string):Promise<GraphListItem>{return this.json<GraphListItem>(await this.request(`/sites/${this.config.siteId}/lists/${listId}/items/${itemId}?$expand=fields($select=${FIELD_SELECT})`));}
  private async findByIdentifier(listId:string,identifier:string):Promise<GraphListItem|null>{const cached=this.cache.get(identifier);if(cached)return cached;const filter=encodeURIComponent(`fields/Title eq '${graphEscape(identifier)}'`);const collection=await this.json<GraphCollection<GraphListItem>>(await this.request(`/sites/${this.config.siteId}/lists/${listId}/items?$expand=fields($select=${FIELD_SELECT})&$filter=${filter}`));const item=collection.value[0]||null;if(item)this.cache.set(identifier,item);return item;}
  private async listByUnit(listId:string,unitId:string):Promise<GraphListItem[]>{const filter=encodeURIComponent(`fields/UnitId eq '${graphEscape(unitId)}'`);const collection=await this.json<GraphCollection<GraphListItem>>(await this.request(`/sites/${this.config.siteId}/lists/${listId}/items?$expand=fields($select=${FIELD_SELECT})&$filter=${filter}`));return collection.value;}
  private async createItem(listId:string,fields:GraphFields):Promise<GraphListItem>{const created=await this.json<GraphListItem>(await this.request(`/sites/${this.config.siteId}/lists/${listId}/items`,{method:'POST',body:JSON.stringify({fields})}));return this.getItemById(listId,created.id);}
  private patchItem(listId:string,item:GraphListItem,fields:GraphFields,expectedETag:string):Promise<Response>{return this.request(`/sites/${this.config.siteId}/lists/${listId}/items/${item.id}/fields`,{method:'PATCH',headers:{'If-Match':expectedETag},body:JSON.stringify(fields)});}
  private parseLive(item:GraphListItem):LiveEnvelope{const payload=JSON.parse(String(item.fields?.PayloadJson||'{}')) as unknown;return isLiveEnvelope(payload)?payload:{state:payload as CurrentShiftState,events:[]};}
  private parsePlan(item:GraphListItem):PlanEnvelope{const payload=JSON.parse(String(item.fields?.PayloadJson||'{}')) as unknown;return isPlanEnvelope(payload)?payload:{workspace:payload as PlanningWorkspace,baseline:null};}
  private async latestLiveResult(item:GraphListItem):Promise<RepositoryResult<CurrentShiftState>>{const fresh=await this.getItemById(this.config.operationalListId,item.id);const key=String(fresh.fields?.Title||'');if(key)this.cache.set(key,fresh);return{data:this.parseLive(fresh).state,metadata:this.metadata(fresh)};}
  private async latestPlanResult(item:GraphListItem):Promise<RepositoryResult<PlanningWorkspace>>{const fresh=await this.getItemById(this.config.operationalListId,item.id);const key=String(fresh.fields?.Title||'');if(key)this.cache.set(key,fresh);return{data:this.parsePlan(fresh).workspace,metadata:this.metadata(fresh)};}

  async loadCurrentShift(unitId:string,date?:string,shiftType?:ShiftType):Promise<RepositoryResult<CurrentShiftState>>{
    let item:GraphListItem|null=null;if(date&&shiftType)item=await this.findByIdentifier(this.config.operationalListId,encodeIdentifier(unitId,date,shiftType,'Live'));
    if(!item){const items=await this.listByUnit(this.config.operationalListId,unitId);item=items.filter(candidate=>candidate.fields?.StateType==='Live').sort((a,b)=>String(b.lastModifiedDateTime||'').localeCompare(String(a.lastModifiedDateTime||'')))[0]||null;}
    if(!item){if(!this.config.seedRepository)throw new Error(`No live SharePoint state exists for unit ${unitId}.`);const seed=await this.config.seedRepository.loadCurrentShift(unitId,date,shiftType);return this.saveCurrentShift(seed.data);}
    const key=String(item.fields?.Title||'');if(key)this.cache.set(key,item);return{data:this.parseLive(item).state,metadata:this.metadata(item)};
  }

  async saveCurrentShift(state:CurrentShiftState,expectedETag?:string):Promise<RepositoryResult<CurrentShiftState>>{
    const identifier=encodeIdentifier(this.unitId,state.date,state.shiftType,'Live');let item=await this.findByIdentifier(this.config.operationalListId,identifier);const envelope:LiveEnvelope=item?{...this.parseLive(item),state}:{state,events:[]};const fields={Title:identifier,UnitId:this.unitId,StateType:'Live',PayloadJson:JSON.stringify(envelope)};
    if(!item){item=await this.createItem(this.config.operationalListId,fields);this.cache.set(identifier,item);return{data:this.parseLive(item).state,metadata:this.metadata(item)};}
    const response=await this.patchItem(this.config.operationalListId,item,fields,expectedETag||item['@odata.etag']||'*');if(response.status===412)throw new RepositoryConflictError(await this.latestLiveResult(item));if(!response.ok)await this.json(response);const fresh=await this.getItemById(this.config.operationalListId,item.id);this.cache.set(identifier,fresh);return{data:this.parseLive(fresh).state,metadata:this.metadata(fresh)};
  }

  async loadPlanningWorkspace(unitId:string,date:string,shiftType:ShiftType):Promise<RepositoryResult<PlanningWorkspace>>{const identifier=encodeIdentifier(unitId,date,shiftType,'Plan');let item=await this.findByIdentifier(this.config.operationalListId,identifier);if(!item){if(!this.config.seedRepository)throw new Error(`No planning SharePoint state exists for ${identifier}.`);const seed=await this.config.seedRepository.loadPlanningWorkspace(unitId,date,shiftType);return this.savePlanningWorkspace(seed.data);}this.cache.set(identifier,item);return{data:this.parsePlan(item).workspace,metadata:this.metadata(item)};}
  async savePlanningWorkspace(workspace:PlanningWorkspace,expectedETag?:string):Promise<RepositoryResult<PlanningWorkspace>>{const identifier=encodeIdentifier(this.unitId,workspace.targetDate,workspace.shiftType,'Plan');let item=await this.findByIdentifier(this.config.operationalListId,identifier);const envelope:PlanEnvelope=item?{...this.parsePlan(item),workspace}:{workspace,baseline:null};const fields={Title:identifier,UnitId:this.unitId,StateType:'Plan',PayloadJson:JSON.stringify(envelope)};if(!item){item=await this.createItem(this.config.operationalListId,fields);this.cache.set(identifier,item);return{data:this.parsePlan(item).workspace,metadata:this.metadata(item)};}const response=await this.patchItem(this.config.operationalListId,item,fields,expectedETag||item['@odata.etag']||'*');if(response.status===412)throw new RepositoryConflictError(await this.latestPlanResult(item));if(!response.ok)await this.json(response);const fresh=await this.getItemById(this.config.operationalListId,item.id);this.cache.set(identifier,fresh);return{data:this.parsePlan(fresh).workspace,metadata:this.metadata(fresh)};}
  async loadPlanBaseline(unitId:string,date:string,shiftType:ShiftType):Promise<RepositoryResult<PlanBaseline|null>>{const item=await this.findByIdentifier(this.config.operationalListId,encodeIdentifier(unitId,date,shiftType,'Plan'));if(!item)return{data:null,metadata:{etag:'',lastModified:new Date().toISOString(),source:'remote'}};return{data:this.parsePlan(item).baseline,metadata:this.metadata(item)};}
  async savePlanBaseline(baseline:PlanBaseline,expectedETag?:string):Promise<RepositoryResult<PlanBaseline>>{const identifier=encodeIdentifier(this.unitId,baseline.date,baseline.shiftType,'Plan');let item=await this.findByIdentifier(this.config.operationalListId,identifier);if(!item){if(!this.config.seedRepository)throw new Error(`Planning workspace must exist before saving baseline ${identifier}.`);await this.loadPlanningWorkspace(this.unitId,baseline.date,baseline.shiftType);item=await this.findByIdentifier(this.config.operationalListId,identifier);}if(!item)throw new Error(`Unable to create planning workspace for ${identifier}.`);const envelope=this.parsePlan(item);envelope.baseline=baseline;const fields={Title:identifier,UnitId:this.unitId,StateType:'Plan',PayloadJson:JSON.stringify(envelope)};const response=await this.patchItem(this.config.operationalListId,item,fields,expectedETag||item['@odata.etag']||'*');if(response.status===412){const latest=await this.getItemById(this.config.operationalListId,item.id);throw new RepositoryConflictError<PlanBaseline|null>({data:this.parsePlan(latest).baseline,metadata:this.metadata(latest)});}if(!response.ok)await this.json(response);const fresh=await this.getItemById(this.config.operationalListId,item.id);this.cache.set(identifier,fresh);return{data:this.parsePlan(fresh).baseline||baseline,metadata:this.metadata(fresh)};}

  async loadHistory(unitId:string):Promise<RepositoryResult<FinalizedShiftSnapshot[]>>{const items=(await this.listByUnit(this.config.historyListId,unitId)).filter(item=>item.fields?.StateType==='History');const data=items.map(item=>JSON.parse(String(item.fields?.PayloadJson||'{}')) as FinalizedShiftSnapshot).sort((a,b)=>b.finalizedAt.localeCompare(a.finalizedAt));const newest=[...items].sort((a,b)=>String(b.lastModifiedDateTime||'').localeCompare(String(a.lastModifiedDateTime||'')))[0];return{data,metadata:newest?this.metadata(newest):{etag:'',lastModified:new Date().toISOString(),source:'remote'}};}
  async saveFinalizedShift(snapshot:FinalizedShiftSnapshot,_expectedETag?:string):Promise<RepositoryResult<FinalizedShiftSnapshot[]>>{const identifier=`${this.unitId}|${snapshot.date}|${snapshot.shiftType}|History|${snapshot.id}`;await this.createItem(this.config.historyListId,{Title:identifier,UnitId:this.unitId,StateType:'History',PayloadJson:JSON.stringify(snapshot)});return this.loadHistory(this.unitId);}

  async loadOperationalEvents(unitId:string,date?:string,shiftType?:ShiftType):Promise<RepositoryResult<OperationalEvent[]>>{const live=await this.loadCurrentShift(unitId,date,shiftType);const item=await this.findByIdentifier(this.config.operationalListId,encodeIdentifier(unitId,live.data.date,live.data.shiftType,'Live'));const data=item?this.parseLive(item).events:[];return{data,metadata:item?this.metadata(item):live.metadata};}
  async appendOperationalEvent(event:OperationalEvent):Promise<RepositoryResult<OperationalEvent[]>>{const identifier=encodeIdentifier(this.unitId,event.shiftDate,event.shiftType,'Live');let item=await this.findByIdentifier(this.config.operationalListId,identifier);if(!item){await this.loadCurrentShift(this.unitId,event.shiftDate,event.shiftType);item=await this.findByIdentifier(this.config.operationalListId,identifier);}if(!item)throw new Error(`No live SharePoint record exists for ${identifier}.`);const envelope=this.parseLive(item);envelope.events=[event,...envelope.events].slice(0,300);const fields={Title:identifier,UnitId:this.unitId,StateType:'Live',PayloadJson:JSON.stringify(envelope)};const response=await this.patchItem(this.config.operationalListId,item,fields,item['@odata.etag']||'*');if(response.status===412){const fresh=await this.getItemById(this.config.operationalListId,item.id);throw new RepositoryConflictError<OperationalEvent[]>({data:this.parseLive(fresh).events,metadata:this.metadata(fresh)});}if(!response.ok)await this.json(response);const fresh=await this.getItemById(this.config.operationalListId,item.id);this.cache.set(identifier,fresh);return{data:this.parseLive(fresh).events,metadata:this.metadata(fresh)};}
}
