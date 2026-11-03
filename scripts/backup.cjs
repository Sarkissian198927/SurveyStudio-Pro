'use strict';
// Local Docker development database backup; never logs credentials or plaintext data.
const fs=require('node:fs'),fsp=require('node:fs/promises'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process'),{pipeline}=require('node:stream/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2),mode=args[0],file=args[1],database=args[2];
const pass=process.env.BACKUP_PASSPHRASE;
if(!['create','restore'].includes(mode)||!file||!pass||pass.length<20)throw Error('Aufruf: BACKUP_PASSPHRASE sicher setzen (mindestens 20 Zeichen), dann backup.cjs create DATEI oder restore DATEI NEUE_DATENBANK.');
const dockerEnv={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[k];
const command=['--host=unix:///var/run/docker.sock','compose','exec','-T','postgres'];
function run(cmd){return spawn('docker',[...command,...cmd],{cwd:root,env:dockerEnv,stdio:['pipe','pipe','pipe']});}
async function finish(child){let error='';child.stderr.on('data',chunk=>error+=chunk);const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});if(code!==0)throw Error('Datenbankwerkzeug fehlgeschlagen. Zielzustand prüfen.');}
(async()=>{
 const target=path.resolve(file);
 if(mode==='create'){
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.scryptSync(pass,salt,32),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const output=fs.createWriteStream(target,{flags:'wx',mode:0o600});output.write(Buffer.concat([Buffer.from('SSBACKUP1'),salt,iv]));
  const child=run(['pg_dump','-U','survey','-d','surveystudio','-Fc']);const result=finish(child);
  await pipeline(child.stdout,cipher,output);await result;await fsp.appendFile(target,cipher.getAuthTag());console.log('Verschlüsseltes Backup erstellt.');
 }else{
  if(!database||!/^restore_[a-z0-9_]{1,50}$/.test(database))throw Error('Restore nur in eine neue Datenbank mit Namen restore_... erlaubt; bestehende Entwicklungs-/Produktivdaten werden nicht überschrieben.');
  const input=await fsp.readFile(target);if(input.subarray(0,9).toString()!=='SSBACKUP1')throw Error('Ungültiges Backupformat.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.scryptSync(pass,input.subarray(9,25),32),input.subarray(25,37));decipher.setAuthTag(input.subarray(-16));
  // Verify GCM before writing anything to PostgreSQL.
  const plain=Buffer.concat([decipher.update(input.subarray(37,-16)),decipher.final()]);
  const create=run(['psql','-U','survey','-d','postgres','-v','ON_ERROR_STOP=1','-c',`CREATE DATABASE "${database}"`]);create.stdout.resume();await finish(create);
  const child=run(['pg_restore','-U','survey','-d',database,'--single-transaction','--exit-on-error']);child.stdout.resume();const result=finish(child);child.stdin.end(plain);await result;plain.fill(0);console.log('Backup authentifiziert und in neue Datenbank wiederhergestellt.');
 }
})().catch(()=>{console.error('Backup/Restore fehlgeschlagen. Keine Geheimnisse protokolliert.');process.exitCode=1;});
