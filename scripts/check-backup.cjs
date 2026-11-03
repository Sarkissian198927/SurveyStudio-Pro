'use strict';
const {spawnSync}=require('node:child_process'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env')});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'survey-backup-test-')),file=path.join(dir,'backup.enc'),database='restore_'+crypto.randomUUID().replaceAll('-',''),schema='backup_test_'+crypto.randomUUID().replaceAll('-','');
const env={...process.env,BACKUP_PASSPHRASE:crypto.randomBytes(48).toString('hex')};
for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
function docker(args){const result=spawnSync('docker',['--host=unix:///var/run/docker.sock','compose','exec','-T','postgres',...args],{cwd:root,env,encoding:'utf8'});assert.equal(result.status,0,'Lokales Docker-Datenbankwerkzeug fehlgeschlagen');return result.stdout.trim();}
function query(name,sql){return docker(['psql','-U','survey','-d',name,'-v','ON_ERROR_STOP=1','-Atc',sql]);}
function migrate(name){const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'Restore-Prüfung verlangt lokale DB');url.pathname='/'+name;url.searchParams.set('options',`-c search_path=${schema},public`);const result=spawnSync(process.execPath,['db/migrate.cjs'],{cwd:root,env:{...env,DATABASE_URL:url.toString()},encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
let madeSchema=false;
try{
 query('surveystudio',`CREATE SCHEMA ${schema}`);madeSchema=true;migrate('surveystudio');
 const [organization,user,project,survey,version,publication]=Array.from({length:6},()=>crypto.randomUUID()),shared=require('../packages/shared'),document=shared.addQuestion(shared.createDraft('Restore Grüße 東京'),'short_text'),doc=JSON.stringify(document),hash=crypto.createHash('sha256').update(doc).digest('hex');
 query('surveystudio',`SET search_path=${schema},public;
 INSERT INTO organizations(id,name) VALUES('${organization}','Restore-Test');
 INSERT INTO users(id,email,password_hash,display_name) VALUES('${user}','restore@example.test','synthetic-not-for-login','Restore Test');
 INSERT INTO organization_members VALUES('${organization}','${user}','owner');
 INSERT INTO projects(id,organization_id,title) VALUES('${project}','${organization}','Restore-Projekt');
 INSERT INTO project_members(project_id,user_id,role,organization_id) VALUES('${project}','${user}','owner','${organization}');
 INSERT INTO surveys(id,organization_id,project_id,title) VALUES('${survey}','${organization}','${project}','Restore Grüße 東京');
 INSERT INTO survey_drafts(survey_id,document) VALUES('${survey}',${literal(doc)}::jsonb);
 INSERT INTO survey_versions(id,organization_id,survey_id,version_no,document,schema_sha256) VALUES('${version}','${organization}','${survey}',1,${literal(doc)}::jsonb,'${hash}');
 INSERT INTO publications(id,organization_id,survey_id,survey_version_id,slug) VALUES('${publication}','${organization}','${survey}','${version}','restore-fixture');
 WITH sessions AS (INSERT INTO response_sessions(organization_id,publication_id,survey_version_id,idempotency_key,answer_sha256) SELECT '${organization}','${publication}','${version}',gen_random_uuid(),'${hash}' FROM generate_series(1,50) RETURNING id)
 INSERT INTO response_items(session_id,question_key,answer_json) SELECT id,'${document.questions[0].key}',to_jsonb('Wiederhergestellt Grüße 東京'::text) FROM sessions;`);
 const fingerprint=`SET search_path=${schema},public; SELECT count(*)||':'||md5(string_agg(rs.id::text||rs.survey_version_id::text||ri.answer_json::text||v.schema_sha256,',' ORDER BY rs.id)) FROM response_sessions rs JOIN response_items ri ON ri.session_id=rs.id JOIN survey_versions v ON v.id=rs.survey_version_id JOIN publications p ON p.id=rs.publication_id JOIN surveys s ON s.id=v.survey_id JOIN projects pr ON pr.id=s.project_id JOIN organization_members m ON m.organization_id=pr.organization_id;`;
 const before=query('surveystudio',fingerprint);assert.match(before,/50:/);
 for(const args of [['create',file],['restore',file,database]]){const result=spawnSync(process.execPath,['scripts/backup.cjs',...args],{cwd:root,env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 assert.equal(query(database,fingerprint),before);migrate(database);assert.equal(query(database,fingerprint),before);
 assert.equal(query(database,`SET search_path=${schema},public; SELECT document=${literal(doc)}::jsonb FROM survey_versions WHERE id='${version}'`),'SET\nt');
 const invalid=spawnSync('docker',['--host=unix:///var/run/docker.sock','compose','exec','-T','postgres','psql','-U','survey','-d',database,'-v','ON_ERROR_STOP=1','-c',`SET search_path=${schema},public; INSERT INTO response_items VALUES('${crypto.randomUUID()}','orphan','null')`],{cwd:root,env,encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/foreign key/i);
 const tampered=fs.readFileSync(file);tampered[40]^=1;fs.writeFileSync(path.join(dir,'tampered.enc'),tampered);
 const rejected=spawnSync(process.execPath,['scripts/backup.cjs','restore',path.join(dir,'tampered.enc'),database+'_bad'],{cwd:root,env,encoding:'utf8'});assert.notEqual(rejected.status,0);
 assert.equal(query('postgres',`SELECT count(*) FROM pg_database WHERE datname='${database}_bad'`),'0');
 console.log('Backup-Roundtrip bestanden: AES-GCM, neue Restore-DB, 50 Antworten samt Unicode, Originalversion/Hash und kritischen Referenzen unverändert; Wiederholungsmigration, Fremdschlüssel und Manipulationserkennung geprüft.');
}finally{query('postgres',`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);if(madeSchema)query('surveystudio',`DROP SCHEMA ${schema} CASCADE`);fs.rmSync(dir,{recursive:true,force:true});}
