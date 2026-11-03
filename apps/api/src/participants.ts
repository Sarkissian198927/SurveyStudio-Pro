import { validateXlsxArchive } from './xlsx-archive';
import { Readable } from 'node:stream';
import { BadRequestException,Body,Controller,Delete,Get,Injectable,NotFoundException,Param,Post,Patch,ConflictException } from '@nestjs/common';
import { createHash,createHmac,randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import { Database } from './database';
import { FeatureService } from './features';
import { decryptMail,encryptMail } from './identity';
import { CurrentUser,Public,Viewer } from './session';
import { PublicSurveyService } from './public';
import * as input from './input';
function parseCsv(text:string){const rows:string[][]=[],row:string[]=[];let cell='',quoted=false;const delimiter=text.split('\n')[0].includes(';')?';':',';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(cell);cell='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push([...row]);row.length=0;cell='';if(rows.length>5001)throw new BadRequestException('Maximal 5000 Teilnehmer.');}else cell+=c;}if(quoted)throw new BadRequestException('Nicht geschlossenes CSV-Anführungszeichen.');row.push(cell);if(row.some(Boolean))rows.push(row);return rows;}
@Injectable()
export class ParticipantService {
 constructor(private readonly db:Database,private readonly features:FeatureService,private readonly publicSurveys:PublicSurveyService){}
 private emailHash(email:string){return createHmac('sha256',process.env.DATA_ENCRYPTION_KEY||process.env.MAIL_ENCRYPTION_KEY||process.env.JWT_SECRET||'').update(email).digest('hex');}
 async list(id:string,userId:string){await this.features.admin(id,userId);const r=await this.db.query('SELECT id,identity_encrypted,created_at FROM invitees WHERE survey_id=$1 ORDER BY created_at LIMIT 5000',[id]);return r.rows.map(x=>({id:x.id,...decryptMail(x.identity_encrypted),created_at:x.created_at}));}
 async import(id:string,userId:string,body:unknown){
  const survey=await this.features.admin(id,userId),data=input.object(body);let rows:string[][];
  if(typeof data.csv==='string'){if(Buffer.byteLength(data.csv)>5_000_000)throw new BadRequestException('CSV zu groß.');rows=parseCsv(data.csv.replace(/^\ufeff/,''));}
  else if(typeof data.base64==='string'&&data.base64.length<7_000_000){
   const bytes=Buffer.from(data.base64,'base64');validateXlsxArchive(bytes);
   rows=[];try{const reader=new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([bytes]),{worksheets:'emit',sharedStrings:'cache',hyperlinks:'ignore',styles:'ignore'});for await(const sheet of reader){for await(const row of sheet){if(rows.length>=5001)throw new BadRequestException('Maximal 5000 Teilnehmer.');rows.push([String(row.getCell(1).text),String(row.getCell(2).text)]);}break;}}catch(e){if(e instanceof BadRequestException)throw e;throw new BadRequestException('Ungültige XLSX-Datei.');}
  }else throw new BadRequestException('CSV-Text oder XLSX-Datei erwartet.');
  if(!rows.length)throw new BadRequestException('Import leer.');
  const header=rows[0].map(x=>x.trim().toLowerCase()),emailIndex=header.findIndex(x=>['email','e-mail','e-mail-adresse'].includes(x)),nameIndex=header.findIndex(x=>['name','displayname'].includes(x));
  if(emailIndex<0)throw new BadRequestException('Erste Zeile muss email,name enthalten.');
  const seen=new Set<string>(),valid:{email:string;name:string;hash:string}[]=[],errors:{row:number;message:string}[]=[];let duplicates=0;
  for(let i=1;i<rows.length;i++)try{const email=input.email(rows[i][emailIndex]),name=(rows[i][nameIndex]||'').trim();if(name.length>120)throw new Error();const hash=this.emailHash(email);if(seen.has(hash)){duplicates++;continue;}seen.add(hash);valid.push({email,name,hash});}catch{errors.push({row:i+1,message:'Ungültige E-Mail-Adresse oder Name zu lang.'});}
  const existing=await this.db.query('SELECT email_hash FROM invitees WHERE survey_id=$1',[id]);const known=new Set(existing.rows.map(x=>x.email_hash));const fresh=valid.filter(v=>!known.has(v.hash));duplicates+=valid.length-fresh.length;
  if(data.dryRun!==false)return {imported:0,valid:fresh.length,duplicates,errors,preview:fresh.slice(0,10).map(v=>({email:v.email,name:v.name}))};
  if(errors.length)throw new BadRequestException('Import enthält ungültige Zeilen. Zuerst Vorschau korrigieren.');
  await this.db.transaction(async c=>{for(const row of fresh)await c.query('INSERT INTO invitees(survey_id,organization_id,identity_encrypted,email_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,survey.organization_id,encryptMail({email:row.email,name:row.name}),row.hash]);});return {imported:fresh.length,duplicates,errors:[]};
 }
 async invite(id:string,userId:string){
  const survey=await this.features.admin(id,userId);return this.db.transaction(async c=>{
   const p=(await c.query("SELECT p.id,p.slug,v.document FROM publications p JOIN survey_versions v ON v.id=p.survey_version_id WHERE p.survey_id=$1 AND p.state='active' ORDER BY p.created_at DESC LIMIT 1",[id])).rows[0];if(!p)throw new BadRequestException('Zuerst eine aktive Umfrage veröffentlichen.');
   const people=await c.query('SELECT id,identity_encrypted FROM invitees WHERE survey_id=$1',[id]);const origin=process.env.PUBLIC_WEB_ORIGIN||'http://localhost:5173';
   for(const person of people.rows){const identity=decryptMail(person.identity_encrypted);let link=`${origin}/s/${p.slug}`;
    if(p.document.privacy.mode!=='anonymous'){const token=randomBytes(32).toString('base64url');await c.query("INSERT INTO invitations(invitee_id,publication_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",[person.id,p.id,createHash('sha256').update(token).digest('hex')]);link=`${origin}/i/${token}`;}
    await c.query('INSERT INTO mail_jobs(organization_id,payload_encrypted,invitee_id) VALUES($1,$2,$3)',[survey.organization_id,encryptMail({to:identity.email,subject:'Einladung: '+survey.title,text:`${identity.name?'Hallo '+identity.name+',':'Guten Tag,'}\n${link}\n${p.document.privacy.mode==='anonymous'?'Anonyme Teilnahme: Der Link ist für alle Empfänger identisch; keine individuelle Teilnahmestatistik.':'Personenbezogene oder pseudonyme Teilnahme gemäß Datenschutzhinweis.'}`}),person.id]);
   }return {queued:people.rowCount,anonymous:p.document.privacy.mode==='anonymous'};
  });
 }
 async delete(id:string,userId:string,personId:string){await this.features.admin(id,userId);await this.db.query('DELETE FROM invitees WHERE survey_id=$1 AND id=$2',[id,input.uuid(personId)]);return {ok:true};}
 async personalData(id:string,userId:string,personId:string){await this.features.admin(id,userId);const p=(await this.db.query('SELECT identity_encrypted FROM invitees WHERE survey_id=$1 AND id=$2',[id,input.uuid(personId)])).rows[0];if(!p)throw new NotFoundException();const responses=(await this.db.query('SELECT r.id,r.submitted_at,ri.question_key,ri.answer_json FROM participant_links l JOIN response_sessions r ON r.id=l.session_id JOIN response_items ri ON ri.session_id=r.id WHERE l.invitee_id=$1',[personId])).rows;return {identity:decryptMail(p.identity_encrypted),responses};}
 async correct(id:string,userId:string,personId:string,body:unknown){await this.features.admin(id,userId);const data=input.object(body),email=input.email(data.email),name=typeof data.name==='string'?data.name.trim():'';if(name.length>120)throw new BadRequestException('Name zu lang.');try{const result=await this.db.query('UPDATE invitees SET identity_encrypted=$1,email_hash=$2 WHERE survey_id=$3 AND id=$4 RETURNING id',[encryptMail({email,name}),this.emailHash(email),id,input.uuid(personId)]);if(!result.rowCount)throw new NotFoundException();return {ok:true};}catch(e:unknown){if(e&&typeof e==='object'&&'code'in e&&e.code==='23505')throw new ConflictException('E-Mail bereits in dieser Liste.');throw e;}}
 async erase(id:string,userId:string,personId:string,body:unknown){const data=await this.personalData(id,userId,personId);if(input.object(body).confirmation!==data.identity.email)throw new BadRequestException('E-Mail zur Bestätigung eingeben.');const jobs=await this.db.transaction(async c=>{await c.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);await c.query('DELETE FROM response_sessions WHERE id IN(SELECT session_id FROM participant_links WHERE invitee_id=$1)',[personId]);await c.query('DELETE FROM report_shares WHERE survey_version_id IN(SELECT id FROM survey_versions WHERE survey_id=$1)',[id]);await c.query('DELETE FROM invitees WHERE survey_id=$1 AND id=$2',[id,personId]);const jobs=await c.query("UPDATE export_jobs SET status='failed',error_code='DATA_DELETED' WHERE survey_id=$1 RETURNING id,format,file_path",[id]);await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) SELECT organization_id,$2,'person.deleted',id FROM surveys WHERE id=$1",[id,userId]);return jobs.rows;});await this.features.removeExportFiles(jobs);return {ok:true};}
 async invitation(token:string){if(!/^[-\w]{43}$/.test(token))throw new NotFoundException();const r=await this.db.query('SELECT p.slug FROM invitations i JOIN publications p ON p.id=i.publication_id WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.expires_at>now()',[createHash('sha256').update(token).digest('hex')]);if(!r.rowCount)throw new NotFoundException('Einladung abgelaufen.');return {...await this.publicSurveys.get(r.rows[0].slug),slug:r.rows[0].slug};}
}
@Controller('surveys')
export class ParticipantController {
 constructor(private readonly people:ParticipantService){}
 @Get(':id/invitees/:personId/export') export(@Param('id') id:string,@Param('personId') p:string,@CurrentUser() u:Viewer){return this.people.personalData(id,u.id,p);}
 @Patch(':id/invitees/:personId') correct(@Param('id') id:string,@Param('personId') p:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.people.correct(id,u.id,p,b);}
 @Post(':id/invitees/:personId/erase') erase(@Param('id') id:string,@Param('personId') p:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.people.erase(id,u.id,p,b);}
 @Get(':id/invitees') list(@Param('id') id:string,@CurrentUser() u:Viewer){return this.people.list(id,u.id);}
 @Post(':id/invitees/import') import(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.people.import(id,u.id,b);}
 @Post(':id/invitations') invite(@Param('id') id:string,@CurrentUser() u:Viewer){return this.people.invite(id,u.id);}
 @Delete(':id/invitees/:personId') delete(@Param('id') id:string,@Param('personId') p:string,@CurrentUser() u:Viewer){return this.people.delete(id,u.id,p);}
}
@Controller('public/invites')
export class InviteController {
 constructor(private readonly people:ParticipantService){}
 @Public() @Get(':token') get(@Param('token') token:string){return this.people.invitation(token);}
}
