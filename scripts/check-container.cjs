'use strict';
const {spawnSync}=require('node:child_process'),{randomBytes,randomUUID}=require('node:crypto'),{Pool}=require('pg'),path=require('node:path'),assert=require('node:assert/strict');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const root=path.resolve(__dirname,'..'),database='smoke_'+randomUUID().replaceAll('-',''),container='survey-smoke-'+randomUUID();
const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
function docker(args,childEnv=env){const r=spawnSync('docker',['--host=unix:///var/run/docker.sock',...args],{cwd:root,env:childEnv,encoding:'utf8'});assert.equal(r.status,0,'Lokales Docker-Werkzeug fehlgeschlagen: '+r.stderr);return r.stdout.trim();}
(async()=>{
 const address=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(address.hostname),'Container-Test nur gegen lokale Entwicklungsdatenbank erlaubt.');
 const admin=new Pool({connectionString:process.env.DATABASE_URL});let made=false,started=false;
 try{
  await admin.query(`CREATE DATABASE "${database}"`);made=true;
  const dbContainer=docker(['compose','ps','-q','postgres']);assert.ok(dbContainer);
  const network=docker(['inspect','--format','{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}',dbContainer]);
  const url=new URL(process.env.DATABASE_URL),runtime={...env,PGHOST:docker(['inspect','--format','{{.Name}}',dbContainer]).replace(/^\//,''),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database,JWT_SECRET:randomBytes(48).toString('hex'),DATA_ENCRYPTION_KEY:randomBytes(48).toString('hex')};
  docker(['run','-d','--name',container,'--network',network,'-p','127.0.0.1:3005:3001','-e','PGHOST','-e','PGUSER','-e','PGPASSWORD','-e','PGDATABASE','-e','JWT_SECRET','-e','DATA_ENCRYPTION_KEY','-e','NODE_ENV=test','-e','COOKIE_SECURE=false','-e','WEB_ORIGIN=http://127.0.0.1:3005','surveystudio-pro:local'],runtime);started=true;
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:3005/api/v1/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready){const log=spawnSync('docker',['--host=unix:///var/run/docker.sock','logs','--tail','60',container],{cwd:root,env,encoding:'utf8'});throw Error('Container nicht bereit: '+log.stdout+log.stderr);}
  assert.equal(docker(['exec',container,'id','-u']),'1000');assert.match(docker(['exec',container,'node','--version']),/^v22\./);
  const html=await fetch('http://127.0.0.1:3005/app/projects');assert.equal(html.status,200);assert.ok((await html.text()).includes('id="root"'));
  const missing=await fetch('http://127.0.0.1:3005/api/v1/missing');assert.equal(missing.status,404);
  const r=await fetch('http://127.0.0.1:3005/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:'Container Test',email:'container@example.test',password:randomBytes(24).toString('hex')})});assert.equal(r.status,201);
  const cookie=r.headers.get('set-cookie').split(';')[0];const projects=await fetch('http://127.0.0.1:3005/api/v1/projects',{headers:{Cookie:cookie}});assert.equal(projects.status,200);assert.equal((await projects.json()).length,1);
  console.log('Container-Smoke bestanden: Node 22, nicht privilegierter App-Benutzer, frische Migrationen, DB-Health, SPA-Fallback, echte Registrierung und Projektpersistenz. HTTP-Testmodus; kein Produktions-TLS-Nachweis.');
 }finally{if(started)docker(['rm','-f',container]);if(made)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
