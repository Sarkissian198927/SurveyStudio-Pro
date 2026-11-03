const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
test('P0-Projektdateien vorhanden',()=>{
  for(const file of ['apps/api/src/main.ts','apps/api/src/auth.ts','apps/api/src/surveys.ts','apps/api/src/public.ts','apps/web/src/App.tsx','db/migrations/001_initial.sql','docker-compose.yml','README.md'])
    assert.ok(fs.existsSync(path.join(root,file)),`${file} fehlt`);
});
test('Datenbank hat getrennte Entwürfe, Veröffentlichungen und Antworten',()=>{
  const sql=read('db/migrations/001_initial.sql');
  for(const table of ['survey_drafts','survey_versions','publications','response_sessions','response_items','project_members']) assert.match(sql,new RegExp(`CREATE TABLE ${table}\\b`));
  assert.match(sql,/UNIQUE\(publication_id,idempotency_key\)/);
});
test('CSRF-Header wird bei geschützten Schreibzugriffen kontrolliert',()=>assert.match(read('apps/api/src/auth.ts'),/x-survey-csrf/));
test('Entwurfs-Revision wird atomar im SQL geprüft',()=>assert.match(read('apps/api/src/surveys.ts'),/WHERE survey_id=\$2 AND revision=\$3/));
