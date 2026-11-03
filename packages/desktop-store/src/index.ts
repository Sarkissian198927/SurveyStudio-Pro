import { addQuestion,calculateResults,canonicalJson,cleanAnswers,createDraft,validateAnswers,validateDraft,validateConsent, type SurveyDraft } from '@surveystudio/shared';
export type SqlOperation={sql:string;values?:unknown[];expectedChanges?:number};
export interface SqlDriver {batch?(operations:SqlOperation[]):Promise<void>;execute(sql:string,values?:unknown[]):Promise<{rowsAffected:number}>;select<T>(sql:string,values?:unknown[]):Promise<T>;}
type Entity={id:string;kind:string;document:string;revision:number};
type LocalSurvey={survey:{id:string;project_id:string;organization_id:string;title:string;state:string};revision:number;document:SurveyDraft;publication:Record<string,unknown>|null};
export class LocalStore {
 private userId='';private organizationId='';
 constructor(private readonly db:SqlDriver){}
 private async run(sql:string,values:unknown[]=[]){return this.db.execute(sql,values);}
 private async atomic(operations:SqlOperation[]){
  if(this.db.batch){await this.db.batch(operations);return;}
  await this.run('BEGIN IMMEDIATE');try{for(const op of operations){const result=await this.run(op.sql,op.values);if(op.expectedChanges!==undefined&&result.rowsAffected!==op.expectedChanges)throw Error('409: Lokaler Versionskonflikt.');}await this.run('COMMIT');}catch(error){await this.run('ROLLBACK');throw error;}
 }
 private insertOperation(kind:string,id:string,value:Record<string,unknown>):SqlOperation{return {sql:'INSERT INTO entities(id,kind,document,revision) VALUES(?,?,?,?)',values:[id,kind,JSON.stringify({...value,id}),Number(value.revision)||1]};}
 private updateOperation(kind:string,id:string,value:Record<string,unknown>,expected:number):SqlOperation{return {sql:'UPDATE entities SET document=?,revision=revision+1 WHERE kind=? AND id=? AND revision=?',values:[JSON.stringify(value),kind,id,expected],expectedChanges:1};}
 private title(value:unknown){if(typeof value!=='string'||!value.trim()||value.trim().length>160)throw Error('Titel muss zwischen 1 und 160 Zeichen enthalten.');return value.trim();}
 private async version(surveyId:string,versionId?:unknown){if(versionId!=null&&typeof versionId!=='string')throw Error('Ungültige Fragebogenversion.');const versions=(await this.entities('version')).filter(v=>v.surveyId===surveyId);const selected=typeof versionId==='string'&&versionId?versions.find(v=>v.id===versionId):versions[versions.length-1];if(versionId&&!selected)throw Error('Fragebogenversion nicht gefunden.');return selected;}
 private async records(versionId:string){return (await this.db.select<{document:string}[]>("SELECT document FROM responses WHERE json_extract(document,'$.versionId')=? ORDER BY rowid",[versionId])).map(r=>JSON.parse(r.document));}
 async initialize(){
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,kind TEXT NOT NULL,document TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)',
   'CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,operation_id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),kind TEXT NOT NULL,entity_id TEXT NOT NULL,document TEXT NOT NULL,base_revision INTEGER NOT NULL)',
   'CREATE TRIGGER IF NOT EXISTS entity_insert AFTER INSERT ON entities BEGIN INSERT INTO outbox(kind,entity_id,document,base_revision) VALUES(new.kind,new.id,new.document,0); END',
   'CREATE TRIGGER IF NOT EXISTS entity_update AFTER UPDATE ON entities BEGIN INSERT INTO outbox(kind,entity_id,document,base_revision) VALUES(new.kind,new.id,new.document,old.revision); END',
   'CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,document TEXT NOT NULL,UNIQUE(publication_id,idempotency_key))',
   "CREATE INDEX IF NOT EXISTS responses_version_idx ON responses(json_extract(document,'$.versionId'))",
   "CREATE INDEX IF NOT EXISTS entities_kind_idx ON entities(kind)",
   "CREATE TRIGGER IF NOT EXISTS response_insert AFTER INSERT ON responses BEGIN INSERT INTO outbox(kind,entity_id,document,base_revision) VALUES('response',new.id,new.document,0); END",
   "CREATE TRIGGER IF NOT EXISTS version_immutable BEFORE UPDATE ON entities WHEN old.kind='version' BEGIN SELECT RAISE(ABORT,'Veröffentlichte Version ist unveränderlich'); END",
   "CREATE TRIGGER IF NOT EXISTS response_policy BEFORE INSERT ON responses WHEN NOT EXISTS(SELECT 1 FROM responses WHERE publication_id=new.publication_id AND idempotency_key=new.idempotency_key) AND EXISTS(SELECT 1 FROM entities p WHERE p.id=new.publication_id AND (json_extract(p.document,'$.state')<>'active' OR julianday(json_extract(p.document,'$.opens_at'))>julianday('now') OR julianday(json_extract(p.document,'$.closes_at'))<=julianday('now') OR COALESCE(json_extract(p.document,'$.max_responses'),2147483647)<=(SELECT count(*) FROM responses WHERE publication_id=new.publication_id))) BEGIN SELECT RAISE(ABORT,'Teilnahmezeitraum oder Antwortlimit erreicht'); END",
   'CREATE TABLE IF NOT EXISTS history(survey_id TEXT NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL,PRIMARY KEY(survey_id,revision))',
   "CREATE TRIGGER IF NOT EXISTS survey_insert AFTER INSERT ON entities WHEN new.kind='survey' BEGIN INSERT OR IGNORE INTO history VALUES(new.id,new.revision,new.document); END",
   "CREATE TRIGGER IF NOT EXISTS survey_history AFTER UPDATE ON entities WHEN new.kind='survey' BEGIN INSERT OR IGNORE INTO history VALUES(new.id,new.revision,new.document); END",
  ])await this.run(sql);
  const users=await this.entities('user'),organizations=await this.entities('organization'),projects=await this.entities('project');
  this.userId=users[0]?.id||crypto.randomUUID();this.organizationId=organizations[0]?.id||crypto.randomUUID();
  const repairs:SqlOperation[]=[];if(!users.length)repairs.push(this.insertOperation('user',this.userId,{email:'',displayName:'Lokales Gerät'}));if(!organizations.length)repairs.push(this.insertOperation('organization',this.organizationId,{name:'Lokaler Arbeitsbereich',role:'owner'}));if(!projects.length)repairs.push(this.insertOperation('project',crypto.randomUUID(),{organization_id:this.organizationId,title:'Lokale Umfragen',role:'owner'}));if(repairs.length)await this.atomic(repairs);
 }
 private async entities(kind:string){const rows=await this.db.select<Entity[]>('SELECT * FROM entities WHERE kind=? ORDER BY rowid',[kind]);return rows.map(r=>({...JSON.parse(r.document),id:r.id}));}
 private async get(id:string,kind?:string){const rows=await this.db.select<Entity[]>('SELECT * FROM entities WHERE id=?'+(kind?' AND kind=?':''),kind?[id,kind]:[id]);if(!rows.length)throw Error('Lokaler Datensatz nicht gefunden.');return JSON.parse(rows[0].document);}
 private async insert(kind:string,id:string,value:Record<string,unknown>){const document={...value,id};await this.run('INSERT INTO entities(id,kind,document,revision) VALUES(?,?,?,?)',[id,kind,JSON.stringify(document),Number(value.revision)||1]);return document;}
 private async update(kind:string,id:string,value:Record<string,unknown>,expected:number){const result=await this.run('UPDATE entities SET document=?,revision=revision+1 WHERE kind=? AND id=? AND revision=?',[JSON.stringify(value),kind,id,expected]);if(!result.rowsAffected)throw Error('409: Lokaler Versionskonflikt.');return value;}
 async pending(){return this.db.select<{seq:number;operation_id:string;kind:string;entity_id:string;document:string;base_revision:number}[]>("SELECT o.* FROM outbox o JOIN (SELECT seq,sum(size) OVER(ORDER BY seq) bytes,row_number() OVER(ORDER BY seq) position FROM (SELECT seq,length(CAST(document AS BLOB)) size FROM outbox WHERE kind IN ('survey','version','publication','response') ORDER BY seq LIMIT 200)) budget ON budget.seq=o.seq WHERE budget.bytes<=10000000 OR budget.position=1 ORDER BY o.seq");}
 async acknowledge(ids:string[]){for(const id of ids)await this.run('DELETE FROM outbox WHERE operation_id=?',[id]);}
 async request(path:string,method='GET',body:Record<string,unknown>={}):Promise<unknown>{
  const [route,query='']=path.split('?'),parts=route.split('/').filter(Boolean),[group,id,action]=parts;
  if(group==='auth'){if(id==='me'||id==='login')return {user:await this.get(this.userId),csrfToken:'local'};if(id==='logout')return {ok:true};throw Error('Kontoverifikation und Mail benötigen die Webinstanz.');}
  if(group==='organizations'){if(!id)return method==='GET'?this.entities('organization'):this.insert('organization',crypto.randomUUID(),{name:this.title(body.name),role:'owner'});if(action==='members'){if(method!=='GET')throw Error('Teamkonten werden über den Online-Zugang verwaltet.');return [{...await this.get(this.userId),display_name:'Lokales Gerät',role:'owner'}];}}
  if(group==='projects'){
   if(!id){if(method==='GET')return this.entities('project');const organizationId=String(body.organizationId||this.organizationId);await this.get(organizationId,'organization');const parent=body.parentProjectId?await this.get(String(body.parentProjectId),'project'):null;if(parent&&parent.organization_id!==organizationId)throw Error('Übergeordnetes Projekt gehört zu einem anderen Arbeitsbereich.');return this.insert('project',crypto.randomUUID(),{organization_id:organizationId,parent_project_id:parent?.id||null,title:this.title(body.title),role:'owner'});}
   if(action==='members'){if(method!=='GET')throw Error('Lokale Berechtigungen werden über das Betriebssystem verwaltet.');return [{...await this.get(this.userId),display_name:'Lokales Gerät',role:'owner'}];}
   const p=await this.get(id,'project');if(method==='PATCH'){const entity=await this.db.select<Entity[]>('SELECT revision FROM entities WHERE id=?',[id]);return this.update('project',id,{...p,title:this.title(body.title)},entity[0].revision);}return p;
  }
  if(group==='public'&&id==='s'){
   const pub=(await this.entities('publication')).find(p=>p.slug===action);if(!pub)throw Error('Lokale Umfrage nicht gefunden.');
   const version=await this.get(pub.versionId,'version');
   if(method==='GET'){if(pub.state!=='active'||pub.opens_at&&Date.parse(pub.opens_at)>Date.now()||pub.closes_at&&Date.parse(pub.closes_at)<=Date.now())throw Error('Umfrage pausiert oder außerhalb des Teilnahmezeitraums.');return {document:version.document};}
   if(typeof body.idempotencyKey!=='string'||!body.idempotencyKey.trim()||body.idempotencyKey.length>100)throw Error('Ungültige Abgabe-ID.');if(!validateConsent(version.document,body.consent))throw Error('Bitte den Datenschutzhinweis bestätigen.');const answers=body.answers as Record<string,unknown>,checked=validateAnswers(version.document,answers);if(!checked.ok)throw Error(checked.errors.join(' · '));
   const cleaned=cleanAnswers(version.document,answers),existing=await this.db.select<{document:string}[]>('SELECT document FROM responses WHERE publication_id=? AND idempotency_key=?',[pub.id,body.idempotencyKey]);
   if(existing.length){const record=JSON.parse(existing[0].document);if(canonicalJson(record.answers)!==canonicalJson(cleaned))throw Error('409: Abgabe-ID bereits für andere Antworten benutzt.');return {ok:true,submissionId:record.id,duplicate:true};}
   if(pub.state!=='active'||pub.opens_at&&Date.parse(pub.opens_at)>Date.now()||pub.closes_at&&Date.parse(pub.closes_at)<=Date.now())throw Error('Umfrage pausiert oder außerhalb des Teilnahmezeitraums.');const record={id:crypto.randomUUID(),publicationId:pub.id,versionId:pub.versionId,idempotencyKey:body.idempotencyKey,answers:cleaned,consent:body.consent,submittedAt:new Date().toISOString()};
   await this.run('INSERT OR IGNORE INTO responses(id,publication_id,idempotency_key,document) VALUES(?,?,?,?)',[record.id,pub.id,record.idempotencyKey,JSON.stringify(record)]);const saved=JSON.parse((await this.db.select<{document:string}[]>('SELECT document FROM responses WHERE publication_id=? AND idempotency_key=?',[pub.id,record.idempotencyKey]))[0].document);if(canonicalJson(saved.answers)!==canonicalJson(cleaned))throw Error('409: Abgabe-ID gehört zu einer anderen Antwort.');return {ok:true,submissionId:saved.id,duplicate:saved.id!==record.id};
  }
  if(group==='surveys'){
   if(!id){if(method==='GET'){const project=new URLSearchParams(query).get('projectId');const rows=await this.db.select<{document:string;response_count:number}[]>("SELECT s.document,(SELECT count(*) FROM responses r JOIN entities v ON v.kind='version' AND v.id=json_extract(r.document,'$.versionId') WHERE json_extract(v.document,'$.surveyId')=s.id) response_count FROM entities s WHERE s.kind='survey' AND json_extract(s.document,'$.survey.project_id')=? ORDER BY s.rowid",[project]);return rows.map(row=>{const s=JSON.parse(row.document);return {...s.survey,revision:s.revision,updated_at:s.updated_at,response_count:row.response_count};});}
    const project=await this.get(String(body.projectId),'project'),id=crypto.randomUUID();const result:LocalSurvey&{updated_at:string}={updated_at:new Date().toISOString(),survey:{id,project_id:project.id,organization_id:project.organization_id,title:this.title(body.title),state:'draft'},revision:1,document:createDraft(this.title(body.title)),publication:null};return this.insert('survey',id,result);
   }
   const s=await this.get(id,'survey') as LocalSurvey;
   if(!action&&method==='GET')return s;
   if(action==='draft'&&method==='PATCH'){
    if(s.survey.state==='archived')throw Error('409: Archivierte Umfrage zuerst wiederherstellen.');const d=body.document as SurveyDraft,checked=validateDraft(d);if(!checked.ok)throw Error(checked.errors.join(' · '));const result={...s,document:d,revision:s.revision+1,survey:{...s.survey,title:d.metadata.title},updated_at:new Date().toISOString()};await this.update('survey',id,result,Number(body.expectedRevision));return {revision:result.revision};
   }
   if(!action&&method==='PATCH'){
    if(body.state!==undefined&&!['draft','archived'].includes(String(body.state)))throw Error('Ungültiger Umfragestatus.');
    const expected=body.expectedRevision===undefined?s.revision:Number(body.expectedRevision);const title=body.title===undefined?s.survey.title:this.title(body.title);const state=body.state===undefined?s.survey.state:String(body.state);const document=structuredClone(s.document);document.metadata.title=title;
    const result={...s,document,revision:s.revision+1,updated_at:new Date().toISOString(),survey:{...s.survey,title,state},publication:s.publication&&state==='archived'?{...s.publication,state:'closed'}:s.publication};const operations:SqlOperation[]=[];
    if(state==='archived')operations.push({sql:"UPDATE entities SET document=json_set(document,'$.state','closed'),revision=revision+1 WHERE kind='publication' AND json_extract(document,'$.surveyId')=?",values:[id]});operations.push(this.updateOperation('survey',id,result,expected));await this.atomic(operations);return result;
   }
   if(action==='publish'){
    if(s.survey.state==='archived')throw Error('409: Archivierte Umfrage zuerst wiederherstellen.');
    if(s.document.privacy.mode!=='anonymous')throw Error('Lokale personenbezogene Zuordnungen sind noch nicht implementiert; diesen Modus in der Webinstanz verwenden.');const checked=validateDraft(s.document,true);if(!checked.ok)throw Error(checked.errors.join(' · '));
    const versions=(await this.entities('version')).filter(v=>v.surveyId===id),versionId=crypto.randomUUID(),publicationId=crypto.randomUUID(),slug=crypto.randomUUID().replaceAll('-','');
    const result={...s,revision:s.revision+1,updated_at:new Date().toISOString(),survey:{...s.survey,state:'published'},publication:{id:publicationId,slug,state:'active',created_at:new Date().toISOString()}};
    await this.atomic([{sql:"UPDATE entities SET document=json_set(document,'$.state','closed'),revision=revision+1 WHERE kind='publication' AND json_extract(document,'$.surveyId')=?",values:[id]},this.insertOperation('version',versionId,{surveyId:id,document:s.document,versionNo:versions.length+1}),this.insertOperation('publication',publicationId,{surveyId:id,versionId,slug,state:'active'}),this.updateOperation('survey',id,result,s.revision)]);return {slug,versionNo:versions.length+1,revision:result.revision};
   }
   if(action==='duplicate'){
    const duplicate=await this.request('/surveys','POST',{projectId:s.survey.project_id,title:(s.survey.title+' (Kopie)').slice(0,160)}) as LocalSurvey;const document=structuredClone(s.document);document.metadata.title=duplicate.survey.title;await this.request(`/surveys/${duplicate.survey.id}/draft`,'PATCH',{expectedRevision:1,document});return this.request(`/surveys/${duplicate.survey.id}`);
   }
   if(action==='history'&&method==='POST'&&parts[3]==='restore'){const rows=await this.db.select<{document:string}[]>('SELECT document FROM history WHERE survey_id=? AND revision=?',[id,body.revision]);if(!rows.length)throw Error('Revision nicht gefunden.');const old=JSON.parse(rows[0].document);return this.request(`/surveys/${id}/draft`,'PATCH',{expectedRevision:body.expectedRevision,document:old.document});}
   if(action==='publication'&&method==='PATCH'){
    if(s.survey.state==='archived')throw Error('409: Archivierte Umfrage zuerst wiederherstellen.');if(!s.publication)throw Error('Noch nicht veröffentlicht.');for(const field of ['opensAt','closesAt'])if(body[field]&&(typeof body[field]!=='string'||!Number.isFinite(Date.parse(body[field] as string))))throw Error('Ungültiger Zeitpunkt.');if(body.opensAt&&body.closesAt&&Date.parse(body.closesAt as string)<=Date.parse(body.opensAt as string))throw Error('Ende muss nach Beginn liegen.');if(body.maxResponses!==undefined&&body.maxResponses!==null&&(!Number.isSafeInteger(body.maxResponses)||Number(body.maxResponses)<1))throw Error('Ungültiges Antwortlimit.');if(!['active','paused','closed'].includes(String(body.state)))throw Error('Ungültiger Status.');const pub=await this.get(String(s.publication.id),'publication');const revision=(await this.db.select<{revision:number}[]>('SELECT revision FROM entities WHERE id=?',[pub.id]))[0].revision;await this.atomic([this.updateOperation('publication',pub.id,{...pub,state:body.state,opens_at:body.opensAt||null,closes_at:body.closesAt||null,max_responses:body.maxResponses||null},revision),this.updateOperation('survey',id,{...s,revision:s.revision+1,survey:{...s.survey,state:body.state==='active'?'published':'paused'},publication:{...s.publication,state:body.state,opens_at:body.opensAt||null,closes_at:body.closesAt||null,max_responses:body.maxResponses||null}},s.revision)]);return {ok:true};
   }
   if(action==='versions')return (await this.entities('version')).filter(v=>v.surveyId===id).map(v=>({id:v.id,version_no:v.versionNo})).reverse();
   if(action==='report'||action==='results'){
    const v=await this.version(id,new URLSearchParams(query).get('versionId'));if(!v)return {totalResponses:0,questions:[]};const records=await this.records(v.id);
    return {...calculateResults(v.document,records.flatMap(r=>Object.entries(r.answers).map(([question_key,answer_json])=>({question_key,answer_json}))),records.length),versionId:v.id,versionNo:v.versionNo};
   }
   if(action==='history')return (await this.db.select<{revision:number;document:string}[]>('SELECT * FROM history WHERE survey_id=? ORDER BY revision DESC',[id])).map(h=>({id:`${id}-${h.revision}`,revision:h.revision,display_name:'Lokales Gerät'}));
   if(action==='comments'){
    if(method==='GET')return (await this.entities('comment')).filter(c=>c.surveyId===id);
    if(parts[4]==='resolve'){const comment=await this.get(parts[3],'comment');const revision=(await this.db.select<{revision:number}[]>('SELECT revision FROM entities WHERE id=?',[comment.id]))[0].revision;await this.update('comment',comment.id,{...comment,resolved:true},revision);return {ok:true};}
    if(typeof body.body!=='string'||!body.body.trim()||body.body.length>4000)throw Error('Ungültiger Kommentar.');return this.insert('comment',crypto.randomUUID(),{surveyId:id,body:body.body,display_name:'Lokales Gerät',resolved:false});
   }
   if(action==='report-shares')throw Error('Öffentliche Ergebnisfreigaben benötigen die Webinstanz.');
   if(action==='responses'&&method==='DELETE'){if(body.confirmation!==s.survey.title)throw Error('Zur Bestätigung den exakten Umfragetitel eingeben.');await this.atomic([{sql:"DELETE FROM outbox WHERE kind='response' AND entity_id IN(SELECT r.id FROM responses r JOIN entities v ON v.id=json_extract(r.document,'$.versionId') WHERE json_extract(v.document,'$.surveyId')=?)",values:[id]},{sql:"DELETE FROM responses WHERE json_extract(document,'$.versionId') IN(SELECT id FROM entities WHERE kind='version' AND json_extract(document,'$.surveyId')=?)",values:[id]}]);return {ok:true};}
   if(action==='exports'){
    if(body.format!=='csv')throw Error('Lokal derzeit CSV verfügbar. PDF/XLSX über die synchronisierte Webinstanz exportieren.');const v=await this.version(id,body.versionId);if(!v)throw Error('Noch nicht veröffentlicht.');const records=await this.records(v.id);
    const cell=(x:unknown)=>{let value=String(x??'');if(typeof x==='string'&&/^(?:\s*[=+@\-]|[\t\r])/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};const content='\ufeff'+[v.document.questions.map((q:{label:string})=>cell(q.label)).join(';'),...records.map(r=>v.document.questions.map((q:{key:string})=>cell(typeof r.answers[q.key]==='object'?JSON.stringify(r.answers[q.key]):r.answers[q.key])).join(';'))].join('\r\n');return {localFile:content,format:'csv'};
   }
  }
  throw Error('Diese Funktion benötigt die Webinstanz oder ist im lokalen Adapter noch nicht verfügbar.');
 }
}
