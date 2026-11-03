'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('@playwright/test');
test('Desktopoberfläche: Offline-Erststart, Freigabe, Abgabe, erneutes Bearbeiten und echter CSV-Speichervorgang',{timeout:60000},async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'survey-native-ui-')),db=new DatabaseSync(path.join(dir,'desktop.db')),saved=[],errors=[];let browser;let cancelled=false;
 const web=spawn(process.execPath,['apps/web/node_modules/vite/bin/vite.js','apps/web','--config','apps/web/vite.config.ts','--host','127.0.0.1','--port','5175','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});const logs=[];for(const stream of [web.stdout,web.stderr])stream.on('data',b=>logs.push(b.toString()));
 try{
  let ready=false;for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:5175')).ok){ready=true;break;}}catch{}if(web.exitCode!==null)throw Error(logs.join(''));await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs.join(''));
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext();
  await context.exposeFunction('nativeCommand',async(command,args,options)=>{
   if(command==='sql_select')return db.prepare(args.sql).all(...args.values);
   if(command==='sql_execute')return {rowsAffected:Number(db.prepare(args.sql).run(...args.values).changes)};
   if(command==='sql_batch'){db.exec('BEGIN IMMEDIATE');try{for(const op of args.operations){const changed=Number(db.prepare(op.sql).run(...(op.values||[])).changes);if(op.expectedChanges!==undefined&&op.expectedChanges!==changed)throw Error('409: Versionskonflikt');}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return;}
   if(command==='plugin:dialog|save')return cancelled?null:path.join(dir,args.options.defaultPath);
   if(command==='plugin:fs|write_file'){const file=decodeURIComponent(options.headers.path);assert.equal(path.dirname(file),dir);fs.writeFileSync(file,Buffer.from(args));saved.push(file);return;}
   throw Error('Unerwartetes natives Kommando: '+command);
  });
  await context.addInitScript(()=>{window.__TAURI_INTERNALS__={invoke:(command,args,options)=>window.nativeCommand(command,command==='plugin:fs|write_file'?Array.from(args):args,options)};});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5175/app');await page.getByLabel('Name der neuen Umfrage').fill('Offline Desktop Test');await page.getByRole('button',{name:'Erstellen',exact:true}).click();await page.getByRole('button',{name:'Erste Frage hinzufügen'}).click();await page.getByLabel('Fragetext',{exact:true}).fill('Desktopfrage');await page.getByRole('button',{name:'Speichern',exact:true}).click();await page.getByText('Gespeichert',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Lokal freigeben',exact:true}).click();await page.getByRole('link',{name:'Lokalen Fragebogen öffnen'}).click();await page.getByRole('button',{name:/Umfrage starten/}).click();await page.getByLabel('Option 1',{exact:true}).check();await page.getByRole('button',{name:/Antworten senden/}).click();await page.getByRole('heading',{name:'Geschafft!'}).waitFor();await page.getByRole('link',{name:'Zur Übersicht',exact:true}).click();
  await page.getByRole('button',{name:/Bearbeiten/}).click();await page.getByRole('button',{name:'Frage 1 bearbeiten',exact:true}).click();await page.getByLabel('Fragetext',{exact:true}).fill('Nach Freigabe geändert');await page.getByRole('button',{name:'Speichern',exact:true}).click();await page.getByText('Gespeichert',{exact:true}).waitFor();assert.equal(await page.getByText('Versionskonflikt',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Ergebnisse',exact:true}).click();await page.getByRole('heading',{name:'1 abgeschlossene Antworten'}).waitFor();await page.getByRole('button',{name:'CSV exportieren'}).click();await page.getByText('Lokaler Export abgeschlossen.',{exact:true}).waitFor();assert.equal(saved.length,1);assert.match(fs.readFileSync(saved[0],'utf8'),/Desktopfrage/);assert.match(fs.readFileSync(saved[0],'utf8'),/option_1/);
  cancelled=true;await page.getByRole('button',{name:'CSV exportieren'}).click();await page.waitForTimeout(150);assert.equal(saved.length,1);await page.reload();await page.getByRole('heading',{name:'1 abgeschlossene Antworten'}).waitFor();assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();if(web.exitCode===null){web.kill('SIGTERM');await new Promise(r=>web.once('exit',r));}db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
