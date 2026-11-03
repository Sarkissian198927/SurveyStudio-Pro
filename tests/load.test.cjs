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
const base='http://127.0.0.1:3103/api/v1';
const password='Test-Passwort-123!';
let db,admin,api,web,owner,outsider,org,project;
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
  const env={DATABASE_URL:url.toString(),JWT_SECRET:randomBytes(48).toString('hex'),API_PORT:'3103',NODE_ENV:'test',COOKIE_SECURE:'false',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_FROM:'',WEB_ORIGIN:'http://127.0.0.1:5174',ASSET_DIR:`/tmp/${schema}/assets`,EXPORT_DIR:`/tmp/${schema}/exports`};
  for(let run=0;run<2;run++){
    const migration=spawnSync(process.execPath,['db/migrate.cjs'],{cwd:root,env:{...process.env,...env},encoding:'utf8'});
    assert.equal(migration.status,0,migration.stderr);
    if(run===1)assert.match(migration.stdout,/Bereits installiert/);
  }
  db=new Pool({connectionString:env.DATABASE_URL});
  api=start(process.execPath,['apps/api/dist/main.js'],env);
  await ready(base+'/health',api);
  web=start(process.execPath,['apps/web/node_modules/vite/bin/vite.js','apps/web','--config','apps/web/vite.config.ts','--host','127.0.0.1','--port','5174','--strictPort'],{API_PROXY_TARGET:'http://127.0.0.1:3103'});
  await ready('http://127.0.0.1:5174',web);
  owner=await register('Owner');outsider=await register('Fremdnutzer');
  org=(await call('/organizations',{session:owner})).data[0];
  project=(await call('/projects',{session:owner})).data[0];
});
after(async()=>{
  for(const child of [api,web])if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
  if(db)await db.end();
  require('node:fs').rmSync(`/tmp/${schema}`,{recursive:true,force:true});
  if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
});

test('Lastprüfung: 100.000 vollständige Einreichungen, 30 Fragen und 100 parallele Abgaben',{timeout:360000},async()=>{
 const shared=require('../packages/shared');let document=shared.createDraft('Synthetischer Lasttest');for(let i=0;i<30;i++){document=shared.addQuestion(document,i===0?'long_text':'short_text');document.questions[i].required=true;}
 const created=await call('/surveys',{method:'POST',session:owner,body:{projectId:project.id,title:document.metadata.title}});const id=created.data.survey.id;await call(`/surveys/${id}/draft`,{method:'PATCH',session:owner,body:{expectedRevision:1,document}});const published=await call(`/surveys/${id}/publish`,{method:'POST',session:owner});assert.equal(published.status,201);
 const publication=(await db.query('SELECT id,survey_version_id FROM publications WHERE slug=$1',[published.data.slug])).rows[0];
 const answers=Object.fromEntries(document.questions.map((q,i)=>[q.key,i===0?'M'.repeat(2000):'Synthetische Antwort']));
 const sha=crypto.createHash('sha256').update(shared.canonicalJson(answers)).digest('hex');
 const seed=performance.now();await db.query(`WITH sessions AS (INSERT INTO response_sessions(organization_id,publication_id,survey_version_id,idempotency_key,answer_sha256) SELECT $1,$2,$3,gen_random_uuid(),$4 FROM generate_series(1,100000) RETURNING id) INSERT INTO response_items(session_id,question_key,answer_json) SELECT s.id,a.key,a.value FROM sessions s CROSS JOIN jsonb_each($5::jsonb) a`,[org.id,publication.id,publication.survey_version_id,sha,JSON.stringify(answers)]);
 assert.equal((await db.query('SELECT count(*)::int n FROM response_sessions WHERE publication_id=$1',[publication.id])).rows[0].n,100000);
 assert.equal((await db.query('SELECT count(*)::int n FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id WHERE rs.publication_id=$1',[publication.id])).rows[0].n,3000000);
 const seedSeconds=Math.round((performance.now()-seed)/1000);
 const latencies=await Promise.all(Array.from({length:100},async()=>{const start=performance.now();const r=await call(`/public/s/${published.data.slug}/responses`,{method:'POST',body:{idempotencyKey:randomUUID(),answers}});assert.equal(r.status,201);return performance.now()-start;}));latencies.sort((a,b)=>a-b);
 const reportStart=performance.now();const report=await call(`/surveys/${id}/report`,{session:owner});assert.equal(report.status,200);assert.equal(report.data.totalResponses,100100);assert.equal(report.data.questions.length,30);assert.ok(report.data.questions.every(q=>q.answered===100100));const reportMs=Math.round(performance.now()-reportStart);
 const exportStart=performance.now(),job=await call(`/surveys/${id}/exports`,{method:'POST',session:owner,body:{format:'csv'}});assert.equal(job.status,201);let status;
 for(let i=0;i<1800;i++){status=await call(`/exports/${job.data.id}`,{session:owner});if(['done','failed'].includes(status.data.status))break;await new Promise(r=>setTimeout(r,100));}assert.equal(status.data.status,'done');const exportMs=Math.round(performance.now()-exportStart);
 const file=await fetch(base+`/exports/${job.data.id}/download`,{headers:{Cookie:owner.cookie}});assert.equal(file.status,200);let csvRows=0,exportBytes=0;for await(const chunk of file.body){exportBytes+=chunk.length;for(const byte of chunk)if(byte===10)csvRows++;}assert.equal(csvRows,100101);
 const result={questions:30,existingSessions:100000,existingAnswers:3000000,concurrent:100,seedSeconds,reportMs,exportMs,exportBytes,p50Ms:Math.round(latencies[49]),p95Ms:Math.round(latencies[94]),maxMs:Math.round(latencies[99]),cpuQuota:'4 CPUs',memoryLimitGiB:32,note:'Synthetische Daten; abweichend von der 8-GB-Referenz des Pflichtenhefts.'};
 require('node:fs').writeFileSync('/tmp/surveystudio-load-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.ok(result.p95Ms<=2000,'p95 der Abgabe überschreitet 2 Sekunden');
});
