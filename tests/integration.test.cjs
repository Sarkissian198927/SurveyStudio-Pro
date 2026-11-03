'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const crypto=require('node:crypto');const {randomUUID,randomBytes}=crypto;
const {Pool}=require('pg');
const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const root=path.resolve(__dirname,'..');
const schema='test_'+randomUUID().replaceAll('-','');
const base='http://127.0.0.1:3101/api/v1';
const password='Test-Passwort-123!';
let db,admin,api,web,owner,outsider,org,project;let stopping=false;
const logs=[];
async function call(route,{method='GET',body,session,csrf=true,headers={}}={}) {
  const response=await fetch(base+route,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,...(csrf?{'X-Survey-CSRF':session.csrfToken}:{})}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
}
async function register(name) {
  const email=`${name.replace(/[^a-z0-9]/gi,'')}-${randomUUID()}@example.test`;
  const result=await call('/auth/register',{method:'POST',body:{displayName:name,email,password}});
  assert.equal(result.status,201);
  assert.match(result.cookie,/survey_session=/);
  return {...result.data,email,cookie:result.cookie};
}
function start(command,args,env) {
  const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>logs.push(chunk.toString()));
  child.on('exit',code=>{if(code&&code!==143&&!stopping)console.error('Dienst beendet ('+code+'):',logs.slice(-25).join(''));});
  return child;
}
async function ready(url,child) {
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('Dienst vorzeitig beendet: '+logs.join(''));
    try{if((await fetch(url)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Dienst nicht bereit: '+logs.join(''));
}
before(async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL muss auf eine lokale PostgreSQL-Testinstanz zeigen.');
  admin=new Pool({connectionString:process.env.DATABASE_URL});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema},public`);
  const env={DATABASE_URL:url.toString(),JWT_SECRET:randomBytes(48).toString('hex'),API_PORT:'3101',NODE_ENV:'test',COOKIE_SECURE:'false',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_FROM:'',WEB_ORIGIN:'http://127.0.0.1:5173',ASSET_DIR:`/tmp/${schema}/assets`,EXPORT_DIR:`/tmp/${schema}/exports`};
  for(let run=0;run<2;run++){
    const migration=spawnSync(process.execPath,['db/migrate.cjs'],{cwd:root,env:{...process.env,...env},encoding:'utf8'});
    assert.equal(migration.status,0,migration.stderr);
    if(run===1)assert.match(migration.stdout,/Bereits installiert/);
  }
  db=new Pool({connectionString:env.DATABASE_URL});
  api=start(process.execPath,['apps/api/dist/main.js'],env);
  await ready(base+'/health',api);
  web=start(process.execPath,['apps/web/node_modules/vite/bin/vite.js','apps/web','--config','apps/web/vite.config.ts','--host','127.0.0.1','--port','5173','--strictPort'],{API_PROXY_TARGET:'http://127.0.0.1:3101'});
  await ready('http://127.0.0.1:5173',web);
  owner=await register('Owner');outsider=await register('Fremdnutzer');
  org=(await call('/organizations',{session:owner})).data[0];
  project=(await call('/projects',{session:owner})).data[0];
});
after(async()=>{
  stopping=true;
  for(const child of [api,web])if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
  if(db)await db.end();
  require('node:fs').rmSync(`/tmp/${schema}`,{recursive:true,force:true});
  if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
});

test('Migrationen werden genau einmal installiert und Mandanten-FKs greifen',async()=>{
  assert.equal((await db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,require('node:fs').readdirSync(path.join(root,'db/migrations')).filter(x=>x.endsWith('.sql')).length);
  await assert.rejects(db.query("INSERT INTO project_members(project_id,user_id,role,organization_id) VALUES($1,$2,'viewer',$3)",[project.id,outsider.user.id,org.id]),e=>e.code==='23503');
});
test('Registrierung speichert Passwort als Hash; doppelte E-Mail wird abgewiesen',async()=>{
  const hash=(await db.query('SELECT password_hash FROM users WHERE id=$1',[owner.user.id])).rows[0].password_hash;
  assert.notEqual(hash,password);assert.match(hash,/^\$2[ab]\$12\$/);
  assert.equal((await call('/auth/register',{method:'POST',body:{displayName:'Duplikat',email:owner.email.toUpperCase(),password}})).status,409);
});
test('Validierung liefert 400 statt Datenbankfehler, einschließlich bcrypt-Bytegrenze',async()=>{
  for(const body of [null,[],{displayName:'Name',email:'x@y.test',password:'ü'.repeat(37)}])assert.equal((await call('/auth/register',{method:'POST',body})).status,400);
  for(const title of [3,{},' ', 'x'.repeat(161)])assert.equal((await call('/projects',{method:'POST',session:owner,body:{organizationId:org.id,title}})).status,400);
  assert.equal((await call('/projects/not-an-id',{session:owner})).status,400);
});
test('Authentifizierung, CSRF und einheitliche Fehlerstruktur',async()=>{
  const r=await call('/projects');assert.equal(r.status,401);assert.equal(r.data.error.code,'UNAUTHENTICATED');assert.equal(r.headers.get('x-request-id'),r.data.requestId);
  assert.equal((await call('/projects',{method:'POST',session:owner,csrf:false,body:{title:'Verboten',organizationId:org.id}})).status,403);
  assert.equal((await call('/auth/login',{method:'POST',body:{email:owner.email,password:'falsch'}})).status,401);
});
test('Mandantenübergreifende Lese-, Schreib- und Mitgliedszugriffe sind verboten',async()=>{
  for(const route of [`/projects/${project.id}`,`/projects/${project.id}/members`,`/organizations/${org.id}/members`])assert.equal((await call(route,{session:outsider})).status,403);
  assert.equal((await call(`/projects/${project.id}`,{method:'PATCH',session:outsider,body:{title:'Angriff'}})).status,403);
  assert.equal((await call('/projects',{method:'POST',session:outsider,body:{title:'Angriff',organizationId:org.id}})).status,403);
  assert.ok(!(await call('/projects',{session:outsider})).data.some(p=>p.id===project.id));
});
test('Arbeitsbereich und Projekt werden dauerhaft gespeichert und nach Login geladen',async()=>{
  const organization=await call('/organizations',{method:'POST',session:owner,body:{name:'Team Grüße 東京'}});assert.equal(organization.status,201);
  const p=await call('/projects',{method:'POST',session:owner,body:{title:'Befragung ÄÖÜ 東京',organizationId:organization.data.id}});assert.equal(p.status,201);
  const child=await call('/projects',{method:'POST',session:owner,body:{title:'Unterordner',organizationId:organization.data.id,parentProjectId:p.data.id}});assert.equal(child.status,201);assert.equal(child.data.parent_project_id,p.data.id);
  const login=await call('/auth/login',{method:'POST',body:{email:owner.email,password}});assert.equal(login.status,201);
  const fresh={...login.data,cookie:login.cookie};
  assert.equal((await call(`/projects/${p.data.id}`,{session:fresh})).data.title,'Befragung ÄÖÜ 東京');
});
test('Viewer liest; Editor schreibt; nur Owner verwaltet; Rechteentzug wirkt sofort',async()=>{
  await call(`/organizations/${org.id}/members`,{method:'POST',session:owner,body:{email:outsider.email}});
  let r=await call(`/projects/${project.id}/members`,{method:'POST',session:owner,body:{email:outsider.email,role:'viewer'}});assert.equal(r.status,201);
  assert.equal((await call(`/projects/${project.id}`,{session:outsider})).status,200);
  assert.equal((await call(`/projects/${project.id}`,{method:'PATCH',session:outsider,body:{title:'Nein'}})).status,403);
  assert.equal((await call(`/projects/${project.id}/members`,{session:outsider})).status,403);
  assert.equal((await call(`/projects/${project.id}/members`,{method:'POST',session:outsider,body:{email:outsider.email,role:'owner'}})).status,403);
  await call(`/projects/${project.id}/members`,{method:'POST',session:owner,body:{email:outsider.email,role:'editor'}});
  assert.equal((await call(`/projects/${project.id}`,{method:'PATCH',session:outsider,body:{title:'Editor war hier'}})).status,200);
  assert.equal((await call(`/projects/${project.id}/members`,{method:'POST',session:outsider,body:{email:outsider.email,role:'owner'}})).status,403);
  await call(`/projects/${project.id}/members/${outsider.user.id}`,{method:'DELETE',session:owner});
  assert.equal((await call(`/projects/${project.id}`,{session:outsider})).status,403);
});
test('Letzter Owner bleibt auch bei parallelen Entfernungen erhalten',async()=>{
  assert.equal((await call(`/projects/${project.id}/members/${owner.user.id}`,{method:'DELETE',session:owner})).status,409);
  assert.equal((await call(`/projects/${project.id}/members`,{method:'POST',session:owner,body:{email:owner.email,role:'viewer'}})).status,409);
  await call(`/projects/${project.id}/members`,{method:'POST',session:owner,body:{email:outsider.email,role:'owner'}});
  const results=await Promise.all([call(`/projects/${project.id}/members/${owner.user.id}`,{method:'DELETE',session:owner}),call(`/projects/${project.id}/members/${outsider.user.id}`,{method:'DELETE',session:outsider})]);
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.ok(results.some(r=>r.status===409));
  assert.equal((await db.query("SELECT count(*)::int n FROM project_members WHERE project_id=$1 AND role='owner'",[project.id])).rows[0].n,1);
});
test('Logout widerruft die Sitzung, auch wenn das alte Cookie wiederverwendet wird',async()=>{
  const u=await register('Logout');
  assert.equal((await call('/auth/logout',{method:'POST',session:u})).status,201);
  assert.equal((await call('/auth/me',{session:u})).status,401);
});
test('Abgelaufene Sitzungen und gesperrte Konten werden zurückgewiesen',async()=>{
  const u=await register('Ablauf');
  await db.query("UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[u.user.id]);
  assert.equal((await call('/auth/me',{session:u})).status,401);
  const v=await register('Sperre');await db.query("UPDATE users SET status='disabled' WHERE id=$1",[v.user.id]);
  assert.equal((await call('/auth/me',{session:v})).status,401);
});
test('OpenAPI ist formal gültig und enthält die I-01-Endpunkte',async()=>{
  const spec=await call('/openapi.json');assert.equal(spec.status,200);
  const parser=require('@apidevtools/swagger-parser');await parser.validate(spec.data);
  for(const route of ['/auth/login','/auth/logout','/projects','/projects/{id}/members','/organizations'])assert.ok(spec.data.paths[route]);
});
test('Bestandsprüfung: neun Fragetypen, Veröffentlichung, parallele Abgabe-Retries und Versionsbindung',async()=>{
  const {createDraft,addQuestion,QUESTION_TYPES}=require('../packages/shared');
  const u=await register('Survey Bestand');
  const p=(await call('/projects',{session:u})).data[0];
  const created=await call('/surveys',{method:'POST',session:u,body:{projectId:p.id,title:'Fragetypenprüfung'}});
  assert.equal(created.status,201);
  const id=created.data.survey.id;
  let document=createDraft('Fragetypenprüfung');
  for(const type of QUESTION_TYPES.slice(0,9))document=addQuestion(document,type.id);
  const values={short_text:'Grüße 東京',long_text:'Ausführliche Antwort mit Unicode äöü',number:42,email:'teilnahme@example.test',date:'2026-11-03',boolean:false,single_choice:'option_1',multi_choice:['option_1','option_2'],dropdown:'option_2'};
  const answers={};
  for(const q of document.questions){q.label='Test '+q.type;q.required=true;answers[q.key]=values[q.type];}
  assert.equal((await call(`/surveys/${id}/draft`,{method:'PATCH',session:u,body:{expectedRevision:1,document}})).status,200);
  assert.equal((await call(`/surveys/${id}/draft`,{method:'PATCH',session:u,body:{expectedRevision:1,document}})).status,409);
  const publication=await call(`/surveys/${id}/publish`,{method:'POST',session:u});assert.equal(publication.status,201);
  const route=`/public/s/${publication.data.slug}`;
  assert.equal((await call(route)).data.document.questions.length,9);
  const invalid=await call(route+'/responses',{method:'POST',body:{idempotencyKey:randomUUID(),answers:{}}});
  assert.equal(invalid.status,422);
  assert.equal((await db.query('SELECT count(*)::int n FROM response_sessions rs JOIN publications pub ON pub.id=rs.publication_id WHERE pub.slug=$1',[publication.data.slug])).rows[0].n,0);
  const body={idempotencyKey:randomUUID(),answers};
  const retries=await Promise.all(Array.from({length:8},()=>call(route+'/responses',{method:'POST',body})));
  assert.ok(retries.every(r=>r.status===201));assert.equal(new Set(retries.map(r=>r.data.submissionId)).size,1);
  const saved=(await db.query('SELECT * FROM response_sessions WHERE id=$1',[retries[0].data.submissionId])).rows[0];
  assert.equal((await db.query('SELECT count(*)::int n FROM response_items WHERE session_id=$1',[saved.id])).rows[0].n,9);
  const results=await call(`/surveys/${id}/results`,{session:u});assert.equal(results.data.totalResponses,1);
  assert.equal(results.data.questions.find(q=>q.type==='number').mean,42);
  assert.equal((await call(`/surveys/${id}/results`,{session:outsider})).status,403);
  const original=(await db.query('SELECT document FROM survey_versions WHERE id=$1',[saved.survey_version_id])).rows[0].document;
  document.questions[0].label='Geänderte Frage';
  await call(`/surveys/${id}/draft`,{method:'PATCH',session:u,body:{expectedRevision:2,document}});
  assert.equal((await call(`/surveys/${id}/publish`,{method:'POST',session:u})).status,201);
  assert.deepEqual((await db.query('SELECT document FROM survey_versions WHERE id=$1',[saved.survey_version_id])).rows[0].document,original);
  assert.equal((await db.query('SELECT survey_version_id FROM response_sessions WHERE id=$1',[saved.id])).rows[0].survey_version_id,saved.survey_version_id);
  assert.equal((await call(`/surveys/${id}/results`,{session:u})).data.totalResponses,0);
});

async function makeSurvey(title='Feature Test') {
 const shared=require('../packages/shared'),u=await register('Feature');
 const p=(await call('/projects',{session:u})).data[0];
 const r=await call('/surveys',{method:'POST',session:u,body:{projectId:p.id,title}});assert.equal(r.status,201);
 let d=shared.addQuestion(shared.addQuestion(shared.createDraft(title),'single_choice'),'number');
 d.questions[0].label='Auswahl Grüße 東京';d.questions[0].required=true;d.questions[1].label='Bewertung';
 assert.equal((await call(`/surveys/${r.data.survey.id}/draft`,{method:'PATCH',session:u,body:{expectedRevision:1,document:d}})).status,200);
 const publication=await call(`/surveys/${r.data.survey.id}/publish`,{method:'POST',session:u});assert.equal(publication.status,201);
 return {u,p,id:r.data.survey.id,d,slug:publication.data.slug};
}
test('AT-01/AT-05: zehn Fragen nach Neuanmeldung und 50 historische Abgaben bleiben versionsgebunden',async()=>{
 const x=await makeSurvey('Historische Abnahme'),shared=require('../packages/shared');for(let i=0;i<8;i++)x.d=shared.addQuestion(x.d,'short_text');
 assert.equal((await call(`/surveys/${x.id}/draft`,{method:'PATCH',session:x.u,body:{expectedRevision:2,document:x.d}})).status,200);
 await call('/auth/logout',{method:'POST',session:x.u});const login=await call('/auth/login',{method:'POST',body:{email:x.u.email,password}});assert.equal(login.status,201);const session={...login.data,cookie:login.cookie};
 assert.deepEqual((await call(`/surveys/${x.id}`,{session})).data.document,x.d);
 const published=await call(`/surveys/${x.id}/publish`,{method:'POST',session});assert.equal(published.status,201);const versions=(await call(`/surveys/${x.id}/versions`,{session})).data,version=versions.find(v=>v.version_no===2);assert.ok(version);
 const answers=Object.fromEntries(x.d.questions.map(q=>[q.key,q.type==='single_choice'?'option_1':q.type==='number'?5:'Historische Antwort']));
 const responses=await Promise.all(Array.from({length:50},()=>call(`/public/s/${published.data.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers}})));assert.ok(responses.every(r=>r.status===201));assert.equal(new Set(responses.map(r=>r.data.submissionId)).size,50);
 const original=structuredClone(x.d);x.d.questions[0].label='Neue Frage';x.d.questions[0].options[0].label='Neue Option';
 assert.equal((await call(`/surveys/${x.id}/draft`,{method:'PATCH',session,body:{expectedRevision:3,document:x.d}})).status,200);assert.equal((await call(`/surveys/${x.id}/publish`,{method:'POST',session})).status,201);
 const old=await call(`/surveys/${x.id}/report?versionId=${version.id}`,{session});assert.equal(old.status,200);assert.equal(old.data.totalResponses,50);assert.equal(old.data.questions[0].label,original.questions[0].label);assert.equal(old.data.questions[0].counts[0].label,original.questions[0].options[0].label);assert.equal(old.data.questions[0].counts[0].count,50);
 assert.equal((await call(`/surveys/${x.id}/report`,{session})).data.totalResponses,0);assert.deepEqual((await db.query('SELECT document FROM survey_versions WHERE id=$1',[version.id])).rows[0].document,original);
 assert.equal((await db.query('SELECT count(*)::int n FROM response_sessions WHERE survey_version_id=$1',[version.id])).rows[0].n,50);
});
test('Passwort-Reset und E-Mail-Verifikation sind einmalig; Reset widerruft bestehende Sitzungen',async()=>{
 const u=await register('Identität');
 let box=await call('/auth/development-mailbox',{session:u});assert.equal(box.status,200);
 const verification=box.data.find(x=>x.subject.includes('bestätigen')).text.match(/#([-\w]{43})/)[1];
 assert.equal((await call('/auth/verification/confirm',{method:'POST',body:{token:verification}})).status,201);
 assert.equal((await call('/auth/verification/confirm',{method:'POST',body:{token:verification}})).status,400);
 assert.equal((await call('/auth/me',{session:u})).data.user.emailVerified,true);
 const neutral=await call('/auth/password-reset/request',{method:'POST',body:{email:'missing@example.test'}});
 const request=await call('/auth/password-reset/request',{method:'POST',body:{email:u.email}});assert.deepEqual(request.data,neutral.data);
 box=await call('/auth/development-mailbox',{session:u});
 const token=box.data.find(x=>x.subject.includes('zurücksetzen')).text.match(/#([-\w]{43})/)[1];
 const encrypted=(await db.query('SELECT payload_encrypted FROM mail_jobs WHERE user_id=$1',[u.user.id])).rows;
 assert.ok(encrypted.every(x=>!x.payload_encrypted.includes(token)));
 const newPassword='Neues-Passwort-456!';
 assert.equal((await call('/auth/password-reset/confirm',{method:'POST',body:{token,password:newPassword}})).status,201);
 assert.equal((await call('/auth/password-reset/confirm',{method:'POST',body:{token,password:newPassword}})).status,400);
 assert.equal((await call('/auth/me',{session:u})).status,401);
 assert.equal((await call('/auth/login',{method:'POST',body:{email:u.email,password:newPassword}})).status,201);
});
test('Metadaten, Duplizieren, Historie, Kommentare und Archivieren funktionieren persistent',async()=>{
 const x=await makeSurvey();
 let current=(await call(`/surveys/${x.id}`,{session:x.u})).data;
 assert.equal((await call(`/surveys/${x.id}`,{method:'PATCH',session:x.u,body:{title:'Neuer Titel',expectedRevision:current.revision}})).status,200);
 const history=await call(`/surveys/${x.id}/history`,{session:x.u});assert.ok(history.data.length>=2);
 current=(await call(`/surveys/${x.id}`,{session:x.u})).data;
 assert.equal((await call(`/surveys/${x.id}/history/restore`,{method:'POST',session:x.u,body:{revision:2,expectedRevision:current.revision}})).status,201);
 const copy=await call(`/surveys/${x.id}/duplicate`,{method:'POST',session:x.u});assert.equal(copy.status,201);assert.notEqual(copy.data.survey.id,x.id);assert.equal(copy.data.document.questions.length,2);
 const comment=await call(`/surveys/${x.id}/comments`,{method:'POST',session:x.u,body:{body:'Bitte prüfen äöü'}});assert.equal(comment.status,201);
 await call(`/surveys/${x.id}/comments/${comment.data.id}/resolve`,{method:'POST',session:x.u});assert.equal((await call(`/surveys/${x.id}/comments`,{session:x.u})).data[0].resolved,true);
 assert.equal((await call(`/surveys/${x.id}`,{method:'PATCH',session:x.u,body:{state:'archived'}})).status,200);
 assert.equal((await call(`/public/s/${x.slug}`)).status,404);
 assert.equal((await call(`/surveys/${x.id}/publish`,{method:'POST',session:x.u})).status,409);
});
test('Zeitsteuerung, Pause, kanonische Idempotenz und unveränderliche Snapshots',async()=>{
 const x=await makeSurvey(),a=x.d.questions[0].key,b=x.d.questions[1].key,key=randomUUID();
 const first=await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:key,answers:{[a]:'option_1',[b]:5}}});assert.equal(first.status,201);
 await call(`/surveys/${x.id}/publication`,{method:'PATCH',session:x.u,body:{state:'paused'}});
 const retry=await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:key,answers:{[b]:5,[a]:'option_1'}}});assert.equal(retry.status,201);assert.equal(retry.data.submissionId,first.data.submissionId);
 assert.equal((await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[a]:'option_1'}}})).status,409);
 await call(`/surveys/${x.id}/publication`,{method:'PATCH',session:x.u,body:{state:'active',opensAt:new Date(Date.now()+3600000).toISOString()}});
 assert.equal((await call(`/public/s/${x.slug}`)).status,404);
 const v=(await db.query('SELECT id FROM survey_versions WHERE survey_id=$1',[x.id])).rows[0].id;
 await assert.rejects(db.query("UPDATE survey_versions SET document='{}'::jsonb WHERE id=$1",[v]),/immutable/);
});
test('Geteilte Ergebnisse sind separate unveränderliche Aggregate mit kompletter Zellsuppression und Widerruf',async()=>{
 const x=await makeSurvey();
 for(let i=0;i<6;i++)assert.equal((await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:i===5?'option_2':'option_1',[x.d.questions[1].key]:42}}})).status,201);
 assert.equal((await call(`/surveys/${x.id}/report-shares`,{method:'POST',session:outsider,body:{}})).status,403);
 const share=await call(`/surveys/${x.id}/report-shares`,{method:'POST',session:x.u,body:{minimumGroup:5,days:1}});assert.equal(share.status,201);
 const result=await call('/public/reports/'+share.data.token);assert.equal(result.status,200);assert.equal(result.data.totalResponses,6);
 assert.equal(result.data.questions[0].suppressed,true);assert.equal(result.data.questions[0].counts,undefined);assert.equal(result.data.questions[0].answered,undefined);assert.equal(result.data.questions[1].mean,42);
 await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1'}}});assert.deepEqual((await call('/public/reports/'+share.data.token)).data,result.data);
 await call(`/surveys/${x.id}/report-shares/${share.data.id}`,{method:'DELETE',session:x.u});assert.equal((await call('/public/reports/'+share.data.token)).status,404);
});
test('CSV, XLSX und Unicode-PDF werden als berechtigte asynchrone Jobs erzeugt',async()=>{
 const x=await makeSurvey('Bericht Grüße 東京');
 await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1',[x.d.questions[1].key]:12}}});
 for(const format of ['csv','xlsx','pdf']){
  const job=await call(`/surveys/${x.id}/exports`,{method:'POST',session:x.u,body:{format}});assert.equal(job.status,201);
  assert.equal((await call(`/exports/${job.data.id}`,{session:outsider})).status,403);
  let status;
  for(let i=0;i<100;i++){status=await call(`/exports/${job.data.id}`,{session:x.u});if(status.data.status==='done'||status.data.status==='failed')break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(status.data.status,'done',JSON.stringify(status.data));
  const file=await fetch(base+`/exports/${job.data.id}/download`,{headers:{Cookie:x.u.cookie}});assert.equal(file.status,200);const bytes=Buffer.from(await file.arrayBuffer());
  if(format==='csv'){assert.ok(bytes.toString('utf8').includes('Grüße 東京'));assert.ok(bytes.toString('utf8').includes('Bewertung'));assert.ok(bytes.toString('utf8').includes('12'));}
  if(format==='xlsx'){const ExcelJS=require(path.join(root,'apps/api/node_modules/exceljs'));const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert.ok(book.worksheets[0].getRow(1).values.some(v=>typeof v==='string'&&v.includes('Grüße 東京')));}if(format==='pdf'){assert.equal(bytes.subarray(0,5).toString(),'%PDF-');const extracted=spawnSync('pdftotext',['-','-'],{input:bytes});assert.equal(extracted.status,0);assert.ok(extracted.stdout.toString().includes('Grüße 東京'));}
 }
});

test('Teilnehmerimport hat Duplikatvorschau, verschlüsselte Identität und verbietet anonyme Antwort-Verknüpfungen',async()=>{
 const x=await makeSurvey(),csv='email,name\nanna@example.test,Anna ÄÖÜ\nanna@example.test,Doppelt\nbert@example.test,Bert';
 const preview=await call(`/surveys/${x.id}/invitees/import`,{method:'POST',session:x.u,body:{csv,dryRun:true}});assert.equal(preview.status,201);assert.equal(preview.data.valid,2);assert.equal(preview.data.duplicates,1);
 assert.equal((await call(`/surveys/${x.id}/invitees`,{session:x.u})).data.length,0);
 assert.equal((await call(`/surveys/${x.id}/invitees/import`,{method:'POST',session:x.u,body:{csv,dryRun:false}})).data.imported,2);
 const people=(await call(`/surveys/${x.id}/invitees`,{session:x.u})).data;assert.equal(people.length,2);assert.equal(people.find(p=>p.email==='anna@example.test').name,'Anna ÄÖÜ');
 assert.equal((await call(`/surveys/${x.id}/invitees`,{session:outsider})).status,403);
 const cipher=(await db.query('SELECT identity_encrypted FROM invitees WHERE survey_id=$1',[x.id])).rows;assert.ok(cipher.every(r=>!r.identity_encrypted.includes('anna@example.test')));
 const ExcelJS=require(path.join(root,'apps/api/node_modules/exceljs'));const workbook=new ExcelJS.Workbook();workbook.addWorksheet('Import').addRows([['email','name'],['xlsx@example.test','XLSX Ü']]);const base64=Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');assert.equal((await call(`/surveys/${x.id}/invitees/import`,{method:'POST',session:x.u,body:{base64,dryRun:true}})).data.valid,1);assert.equal((await call(`/surveys/${x.id}/invitees/import`,{method:'POST',session:x.u,body:{base64,dryRun:false}})).data.imported,1);
 const invitation=await call(`/surveys/${x.id}/invitations`,{method:'POST',session:x.u});assert.equal(invitation.data.queued,3);assert.equal(invitation.data.anonymous,true);
 assert.equal((await db.query('SELECT count(*)::int n FROM invitations i JOIN invitees p ON p.id=i.invitee_id WHERE p.survey_id=$1',[x.id])).rows[0].n,0);
 const submitted=await call(`/public/s/${x.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1'}}});assert.equal(submitted.status,201);
 const pub=(await db.query('SELECT id FROM publications WHERE slug=$1',[x.slug])).rows[0].id;
 const fakeInvite=(await db.query("INSERT INTO invitations(invitee_id,publication_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day') RETURNING id",[people[0].id,pub,'a'.repeat(64)])).rows[0].id;
 await assert.rejects(db.query('INSERT INTO participant_links(session_id,invitee_id,publication_id,invitation_id) VALUES($1,$2,$3,$4)',[submitted.data.submissionId,people[0].id,pub,fakeInvite]),/Anonymous/);
});
test('Pseudonyme Antworten benötigen persönliche Einladungen und sind getrennt zugeordnet',async()=>{
 const x=await makeSurvey();x.d.privacy.mode='pseudonymous';
 await call(`/surveys/${x.id}/draft`,{method:'PATCH',session:x.u,body:{expectedRevision:2,document:x.d}});
 const p=await call(`/surveys/${x.id}/publish`,{method:'POST',session:x.u});const slug=p.data.slug;
 assert.equal((await call(`/public/s/${slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1'}}})).status,422);
 await call(`/surveys/${x.id}/invitees/import`,{method:'POST',session:x.u,body:{csv:'email,name\nprivate@example.test,Privat',dryRun:false}});
 const person=(await call(`/surveys/${x.id}/invitees`,{session:x.u})).data[0];const pub=(await db.query('SELECT id FROM publications WHERE slug=$1',[slug])).rows[0].id;
 const token=crypto.randomBytes(32).toString('base64url');await db.query("INSERT INTO invitations(invitee_id,publication_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",[person.id,pub,crypto.createHash('sha256').update(token).digest('hex')]);
 const body={idempotencyKey:randomUUID(),inviteToken:token,answers:{[x.d.questions[0].key]:'option_1'}};
 assert.equal((await call(`/public/s/${slug}/responses`,{method:'POST',body})).status,201);
 assert.equal((await call(`/public/s/${slug}/responses`,{method:'POST',body})).status,201);
 assert.equal((await call(`/public/s/${slug}/responses`,{method:'POST',body:{...body,idempotencyKey:randomUUID()}})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM participant_links WHERE invitee_id=$1',[person.id])).rows[0].n,1);
 const information=await call(`/surveys/${x.id}/invitees/${person.id}/export`,{session:x.u});assert.equal(information.status,200);assert.equal(information.data.identity.email,'private@example.test');assert.ok(information.data.responses.length>0);
 assert.equal((await call(`/surveys/${x.id}/invitees/${person.id}`,{method:'PATCH',session:x.u,body:{email:'corrected@example.test',name:'Berichtigt'}})).status,200);
 const job=await call(`/surveys/${x.id}/exports`,{method:'POST',session:x.u,body:{format:'csv'}});
 for(let i=0;i<100;i++){if((await call(`/exports/${job.data.id}`,{session:x.u})).data.status==='done')break;await new Promise(r=>setTimeout(r,50));}
 assert.equal((await call(`/surveys/${x.id}/invitees/${person.id}/erase`,{method:'POST',session:x.u,body:{confirmation:'wrong'}})).status,400);
 assert.equal((await call(`/surveys/${x.id}/invitees/${person.id}/erase`,{method:'POST',session:x.u,body:{confirmation:'corrected@example.test'}})).status,201);
 assert.equal((await db.query('SELECT count(*)::int n FROM response_sessions WHERE publication_id=$1',[pub])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM invitees WHERE id=$1',[person.id])).rows[0].n,0);
 assert.equal((await call(`/exports/${job.data.id}`,{session:x.u})).data.status,'failed');

});
test('Echte SQLite-Outbox synchronisiert ohne Doppelantwort und meldet serverseitige Revisionskonflikte',async()=>{
 const {DatabaseSync}=require('node:sqlite'),{LocalStore}=require('../packages/desktop-store/dist');const sqlite=new DatabaseSync(':memory:');
 try{
  const local=new LocalStore({execute:async(sql,params=[])=>({rowsAffected:Number(sqlite.prepare(sql).run(...params).changes)}),select:async(sql,params=[])=>sqlite.prepare(sql).all(...params)});await local.initialize();
  const localProject=(await local.request('/projects'))[0],created=await local.request('/surveys','POST',{projectId:localProject.id,title:'Synchronisiert'}),id=created.survey.id;
  const shared=require('../packages/shared');const document=shared.addQuestion(shared.createDraft('Synchronisiert'),'short_text');await local.request(`/surveys/${id}/draft`,'PATCH',{expectedRevision:1,document});
  const publication=await local.request(`/surveys/${id}/publish`,'POST');await local.request(`/public/s/${publication.slug}/responses`,'POST',{idempotencyKey:randomUUID(),answers:{[document.questions[0].key]:'Offline Antwort'}});
  const user=await register('Sync'),target=(await call('/projects',{session:user})).data[0],access=await call('/auth/device-token',{method:'POST',session:user});assert.equal(access.status,201);
  const headers={Authorization:'Bearer '+access.data.token};
  const pending=await local.pending(),body={targetProjectId:target.id,operations:pending.map(o=>({operationId:o.operation_id,kind:o.kind,id:o.entity_id,document:JSON.parse(o.document),baseRevision:o.base_revision}))};
  const first=await call('/sync/push',{method:'POST',headers,body});assert.equal(first.status,201,JSON.stringify(first.data));
  const retry=await call('/sync/push',{method:'POST',headers,body});assert.equal(retry.status,201);assert.deepEqual(retry.data,first.data);
  assert.equal((await db.query('SELECT count(*)::int n FROM response_sessions WHERE publication_id IN(SELECT id FROM publications WHERE survey_id=$1)',[id])).rows[0].n,1);
  assert.equal((await db.query('SELECT state FROM publications WHERE survey_id=$1',[id])).rows[0].state,'paused');
  await local.acknowledge(first.data.applied);const remote=(await call(`/surveys/${id}`,{session:user})).data;
  await call(`/surveys/${id}/draft`,{method:'PATCH',session:user,body:{expectedRevision:remote.revision,document:{...document,metadata:{...document.metadata,title:'Serveränderung'}}}});
  await local.request(`/surveys/${id}/draft`,'PATCH',{expectedRevision:3,document:{...document,metadata:{...document.metadata,title:'Lokale Änderung'}}});
  const conflict=await local.pending();assert.equal((await call('/sync/push',{method:'POST',headers,body:{targetProjectId:target.id,operations:conflict.map(o=>({operationId:o.operation_id,kind:o.kind,id:o.entity_id,document:JSON.parse(o.document),baseRevision:o.base_revision}))}})).status,409);assert.equal((await local.pending()).length,1);
  await call('/auth/device-token',{method:'DELETE',session:user});assert.equal((await call('/sync/push',{method:'POST',headers,body})).status,401);
 }finally{sqlite.close();}
});

test('Alle 19 Fragetypen durchlaufen echte Veröffentlichung und Abgabe',async()=>{
 const shared=require('../packages/shared'),u=await register('AlleTypen'),p=(await call('/projects',{session:u})).data[0];
 const created=await call('/surveys',{method:'POST',session:u,body:{projectId:p.id,title:'Alle Fragetypen'}});const id=created.data.survey.id;
 let d=shared.createDraft('Alle Fragetypen');const answers={};for(const t of shared.QUESTION_TYPES){d=shared.addQuestion(d,t.id);const q=d.questions[d.questions.length-1];q.required=true;answers[q.key]=t.id==='boolean'?false:['number','rating','nps','slider'].includes(t.id)?3:t.id==='email'?'person@example.test':t.id==='date'?'2026-11-03':t.id==='multi_choice'?['option_1']:t.id==='ranking'?q.options.map(o=>o.value):t.id==='matrix_single'||t.id==='matrix_multi'?Object.fromEntries(q.rows.map(r=>[r.value,t.id==='matrix_multi'?['option_1']:'option_1'])):t.id==='file_upload'?{name:'test.pdf',mime:'application/pdf',size:9,data:'data:application/pdf;base64,'+btoa('%PDF-1.7\n')}:q.options.length?q.options[0].value:'Antwort äöü';}
 assert.equal((await call(`/surveys/${id}/draft`,{method:'PATCH',session:u,body:{expectedRevision:1,document:d}})).status,200);
 const published=await call(`/surveys/${id}/publish`,{method:'POST',session:u});assert.equal(published.status,201);
 const submitted=await call(`/public/s/${published.data.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers}});assert.equal(submitted.status,201,JSON.stringify(submitted.data));
 assert.equal((await db.query('SELECT count(*)::int n FROM response_items WHERE session_id=$1',[submitted.data.submissionId])).rows[0].n,19);
});
test('Löschfristen und Owner-Audit wirken serverseitig; Analyst hat keine Rohdatenrechte',async()=>{
 const x=await makeSurvey();x.d.privacy.retentionDays=1;
 await call(`/surveys/${x.id}/draft`,{method:'PATCH',session:x.u,body:{expectedRevision:2,document:x.d}});const published=await call(`/surveys/${x.id}/publish`,{method:'POST',session:x.u});
 const r=await call(`/public/s/${published.data.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1'}}});
 await db.query("UPDATE response_sessions SET submitted_at=now()-interval '2 days' WHERE id=$1",[r.data.submissionId]);
 assert.equal((await call(`/surveys/${x.id}/retention/run`,{method:'POST',session:x.u})).data.deleted,1);
 const audit=await call(`/projects/${x.p.id}/audit`,{session:x.u});assert.equal(audit.status,200);assert.ok(audit.data.length>0);await assert.rejects(db.query("UPDATE audit_events SET action='tampered' WHERE id=$1",[audit.data[0].id]),/append-only/);
 await call(`/organizations/${x.p.organization_id}/members`,{method:'POST',session:x.u,body:{email:outsider.email}});assert.equal((await call(`/projects/${x.p.id}/members`,{method:'POST',session:x.u,body:{email:outsider.email,role:'analyst'}})).status,201);
 assert.equal((await call(`/surveys/${x.id}/report`,{session:outsider})).status,200);assert.equal((await call(`/surveys/${x.id}/exports`,{method:'POST',session:outsider,body:{format:'csv'}})).status,403);
});
test('Browser: variable Hintergründe sind nach Speichern, Vorschau und Veröffentlichung identisch',{timeout:30000},async()=>{
 const x=await makeSurvey('Hintergrundprüfung'),{chromium}=require('@playwright/test');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{const context=await browser.newContext();const cookie=x.u.cookie.split('=');await context.addCookies([{name:cookie[0],value:cookie.slice(1).join('='),domain:'127.0.0.1',path:'/api/v1'}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(`http://127.0.0.1:5173/app/surveys/${x.id}/edit`);
 await page.getByRole('button',{name:'Design',exact:true}).click();await page.getByLabel('Hintergrundmodus',{exact:true}).selectOption('gradient');await page.getByLabel('Zweite Hintergrundfarbe',{exact:true}).fill('#ffddee');await page.getByRole('button',{name:'Speichern',exact:true}).click();await page.getByText('Gespeichert',{exact:true}).waitFor();
 const canvas=await page.locator('.editor-canvas').evaluate(e=>getComputedStyle(e).backgroundImage);assert.ok(canvas.includes('linear-gradient'));
 await page.getByRole('button',{name:'Vorschau',exact:true}).click();assert.equal(await page.locator('.survey-runtime').evaluate(e=>getComputedStyle(e).backgroundImage),canvas);
 await page.getByRole('button',{name:'Veröffentlichen',exact:true}).click();const link=await page.getByLabel('Öffentlicher Umfragelink',{exact:true}).inputValue();const png=await page.locator('.qr-preview img').getAttribute('src');const bitmap=require('pngjs').PNG.sync.read(Buffer.from(png.split(',')[1],'base64'));const decoded=require('jsqr')(new Uint8ClampedArray(bitmap.data),bitmap.width,bitmap.height);assert.equal(decoded.data,link);const publicPage=await context.newPage();await publicPage.goto(link);await publicPage.getByRole('button',{name:/Umfrage starten/}).waitFor();require('node:fs').mkdirSync(path.join(root,'docs/screenshots'),{recursive:true});await publicPage.screenshot({path:path.join(root,'docs/screenshots/background-preview.png'),fullPage:true});assert.equal(await publicPage.locator('.survey-runtime').evaluate(e=>getComputedStyle(e).backgroundImage),canvas);
 await publicPage.getByRole('button',{name:/Umfrage starten/}).click();await publicPage.getByRole('button',{name:/Antworten senden/}).click();await publicPage.getByRole('alert').waitFor();await publicPage.getByLabel('Option 1',{exact:true}).check();await publicPage.getByRole('button',{name:/Antworten senden/}).click();await publicPage.getByRole('heading',{name:'Geschafft!'}).waitFor();
 }finally{await browser.close();}
});

test('Medien werden decodiert, neu kodiert, berechtigt und erst nach Veröffentlichung öffentlich',async()=>{
 const x=await makeSurvey(),sharp=require(path.join(root,'apps/api/node_modules/sharp'));const image=await sharp({create:{width:4,height:4,channels:3,background:'#336699'}}).png().toBuffer();const data='data:image/png;base64,'+image.toString('base64');
 const upload=await call('/assets',{method:'POST',session:x.u,body:{projectId:x.p.id,data}});assert.equal(upload.status,201,JSON.stringify(upload.data));
 const url=upload.data.url;assert.equal((await fetch('http://127.0.0.1:3101'+url)).status,404);
 const privateImage=await fetch('http://127.0.0.1:3101'+url,{headers:{Cookie:x.u.cookie}});assert.equal(privateImage.status,200);assert.equal(privateImage.headers.get('content-type'),'image/webp');
 assert.equal((await call('/assets',{method:'POST',session:x.u,body:{projectId:x.p.id,data:'data:image/png;base64,'+btoa('<script>bad</script>')}})).status,400);
 x.d.theme.backgroundMode='image';x.d.theme.backgroundImage=url;assert.equal((await call(`/surveys/${x.id}/draft`,{method:'PATCH',session:x.u,body:{expectedRevision:2,document:x.d}})).status,200);
 await call(`/surveys/${x.id}/publish`,{method:'POST',session:x.u});assert.equal((await fetch('http://127.0.0.1:3101'+url)).status,200);
 const other=await makeSurvey();other.d.theme.backgroundImage=url;assert.equal((await call(`/surveys/${other.id}/draft`,{method:'PATCH',session:other.u,body:{expectedRevision:2,document:other.d}})).status,403);
 assert.equal((await call(url.replace('/api/v1/public/assets/','/assets/'),{method:'DELETE',session:x.u})).status,400);
});

test('Pflichtbestätigung wird serverseitig versionsgebunden gespeichert',async()=>{
 const x=await makeSurvey();Object.assign(x.d.privacy,{requireConsent:true,noticeRevision:'notice-v1',consentText:'Testhinweis bestätigen'});await call(`/surveys/${x.id}/draft`,{method:'PATCH',session:x.u,body:{expectedRevision:2,document:x.d}});const publication=await call(`/surveys/${x.id}/publish`,{method:'POST',session:x.u});assert.equal(publication.status,201);
 const body={idempotencyKey:randomUUID(),answers:{[x.d.questions[0].key]:'option_1'}};
 assert.equal((await call(`/public/s/${publication.data.slug}/responses`,{method:'POST',body})).status,422);
 const accepted=await call(`/public/s/${publication.data.slug}/responses`,{method:'POST',body:{...body,consent:{accepted:true,noticeRevision:'notice-v1'}}});assert.equal(accepted.status,201);
 const saved=(await db.query('SELECT notice_revision,consent_given FROM response_sessions WHERE id=$1',[accepted.data.submissionId])).rows[0];assert.equal(saved.notice_revision,'notice-v1');assert.equal(saved.consent_given,true);
});
test('Browser: Registrierung, Projekt anlegen, neu laden, abmelden und erneut anmelden',{timeout:30000},async()=>{
  const {chromium}=require('@playwright/test');
  const browser=await chromium.launch({headless:true,timeout:10000,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(5000);
    page.on('response',r=>{if(r.status()>=400)console.log('Browser HTTP',r.status(),new URL(r.url()).pathname);});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const email=`browser-${randomUUID()}@example.test`;
    console.log('Browser: Registrierungsseite öffnen');
    await page.goto('http://127.0.0.1:5173/register');
    await page.getByLabel('Dein Name').fill('Browser Test');await page.getByLabel('E-Mail-Adresse').fill(email);await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Kostenlos starten'}).click();await page.waitForURL('**/app');
    console.log('Browser: Projektverwaltung öffnen');
    await page.getByRole('link',{name:'Projekte',exact:true}).click();
    await page.getByLabel(/^Neues Projekt in/).fill('Browser Projekt');await page.getByRole('button',{name:'Projekt erstellen',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Projekt erstellt.'}).waitFor();
    await page.reload();await page.getByLabel('Projekt',{exact:true}).selectOption({label:'Browser Projekt (owner)'});
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();await page.waitForURL('**/login');
    await page.getByLabel('E-Mail-Adresse').fill(email);await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.waitForURL('**/app');
    console.log('Browser: Projektverwaltung öffnen');
    await page.getByRole('link',{name:'Projekte',exact:true}).click();
    await page.getByLabel('Projekt',{exact:true}).selectOption({label:'Browser Projekt (owner)'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile Seite darf nicht horizontal überlaufen');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
test('Onlinebetrieb: erstes Administratorkonto, TLS-Anmeldung und neue Umfrage funktionieren ohne Entwicklungsmodus',{timeout:60000},async()=>{
 const {provision}=require('../scripts/bootstrap-admin.cjs'),fs=require('node:fs'),https=require('node:https'),http=require('node:http');const isolated='online_'+randomUUID().replaceAll('-',''),dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'survey-online-'));let pool,production,gateway;
 try{await admin.query(`CREATE SCHEMA ${isolated}`);const address=new URL(process.env.DATABASE_URL);address.searchParams.set('options',`-c search_path=${isolated},public`);const env={DATABASE_URL:address.toString(),NODE_ENV:'production',COOKIE_SECURE:'true',JWT_SECRET:randomBytes(48).toString('hex'),DATA_ENCRYPTION_KEY:randomBytes(48).toString('hex'),API_PORT:'3107',SERVE_WEB:'true',TRUST_PROXY_HOPS:'1',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_FROM:''};const migration=spawnSync(process.execPath,['db/migrate.cjs'],{cwd:root,env:{...process.env,...env},encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);pool=new Pool({connectionString:env.DATABASE_URL});const credentials='Nur-Test-'+randomBytes(20).toString('hex');assert.equal(await provision(pool,'operator@example.test',credentials),true);const original=(await pool.query('SELECT id,password_hash,verified_at FROM users')).rows[0];assert.ok(original.verified_at);assert.equal(await provision(pool,'other@example.test','Anderes-Testpasswort-12345'),false);assert.equal((await pool.query('SELECT password_hash FROM users')).rows[0].password_hash,original.password_hash);
  const openssl=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{encoding:'utf8'});assert.equal(openssl.status,0);production=start(process.execPath,['apps/api/dist/main.js'],env);await ready('http://127.0.0.1:3107/api/v1/health',production);
  gateway=https.createServer({key:fs.readFileSync(path.join(dir,'key.pem')),cert:fs.readFileSync(path.join(dir,'cert.pem'))},(request,response)=>{const proxy=http.request({hostname:'127.0.0.1',port:3107,path:request.url,method:request.method,headers:{...request.headers,'x-forwarded-for':'127.0.0.1','x-forwarded-proto':'https'}},remote=>{response.writeHead(remote.statusCode,remote.headers);remote.pipe(response);});proxy.on('error',()=>{response.writeHead(502);response.end();});request.pipe(proxy);});await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));const port=gateway.address().port;
  const tlsCall=(route,{method='GET',body,session}={})=>new Promise((resolve,reject)=>{const request=https.request({hostname:'127.0.0.1',port,path:route,method,ca:fs.readFileSync(path.join(dir,'cert.pem')),headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session.cookie,'X-Survey-CSRF':session.csrfToken}:{})}},response=>{let bytes='';response.on('data',chunk=>bytes+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:route.startsWith('/api/')?JSON.parse(bytes):bytes,cookie:response.headers['set-cookie']?.[0].split(';')[0],setCookie:response.headers['set-cookie']?.[0]}));});request.on('error',reject);request.end(body?JSON.stringify(body):undefined);});
  const health=await tlsCall('/api/v1/health');assert.equal(health.status,200);assert.equal(health.data.service,'surveystudio-pro');assert.equal((await tlsCall('/login')).status,200);const login=await tlsCall('/api/v1/auth/login',{method:'POST',body:{email:'operator@example.test',password:credentials}});assert.equal(login.status,201);assert.match(login.setCookie,/Secure/);assert.match(login.setCookie,/HttpOnly/);const session={...login.data,cookie:login.cookie};const projects=await tlsCall('/api/v1/projects',{session});assert.equal(projects.status,200);assert.equal(projects.data.length,1);const created=await tlsCall('/api/v1/surveys',{method:'POST',session,body:{projectId:projects.data[0].id,title:'Online neu erstellt'}});assert.equal(created.status,201);assert.equal((await tlsCall('/api/v1/surveys/'+created.data.survey.id,{session})).data.document.metadata.title,'Online neu erstellt');
 }finally{if(gateway)await new Promise(resolve=>gateway.close(resolve));if(production&&production.exitCode===null){production.kill('SIGTERM');await new Promise(resolve=>production.once('exit',resolve));}if(pool)await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${isolated} CASCADE`);fs.rmSync(dir,{recursive:true,force:true});}
});
