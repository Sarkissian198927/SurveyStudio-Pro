import { BadRequestException, Body, Controller, Get, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, Post } from '@nestjs/common';
import { PoolClient } from 'pg';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { Database } from './database';
import { CurrentUser, Public, Viewer } from './session';
import * as input from './input';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function key(){return createHash('sha256').update('SurveyStudio:mail:'+ (process.env.DATA_ENCRYPTION_KEY||process.env.MAIL_ENCRYPTION_KEY||process.env.JWT_SECRET||'')).digest();}
export function encryptMail(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64')).join('.');}
export function decryptMail(value:string){const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')) as {to:string;subject:string;text:string;email?:string;name?:string};}
@Injectable()
export class IdentityService implements OnModuleInit,OnModuleDestroy {
 private timer?:NodeJS.Timeout;private working=false;
 constructor(private readonly db:Database){}
 onModuleInit(){if(this.configured()){this.timer=setInterval(()=>void this.deliver(),10000);this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 configured(){return !!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD&&process.env.SMTP_FROM);}
 async issue(client:PoolClient,userId:string,email:string,purpose:'verify'|'reset'){
  const token=randomBytes(32).toString('base64url');
  await client.query('UPDATE identity_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL',[userId,purpose]);
  await client.query("INSERT INTO identity_tokens(user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[userId,purpose,digest(token)]);
  const origin=process.env.PUBLIC_WEB_ORIGIN||'http://localhost:5173';
  const link=`${origin}/account/${purpose}#${token}`;
  await client.query('INSERT INTO mail_jobs(user_id,payload_encrypted) VALUES($1,$2)',[userId,encryptMail({to:email,subject:purpose==='verify'?'E-Mail-Adresse bestätigen':'Passwort zurücksetzen',text:`${purpose==='verify'?'Bestätige deine E-Mail-Adresse':'Setze dein Passwort zurück'}: ${link}\nDieser Link gilt 30 Minuten und kann einmal verwendet werden.`})]);
 }
 async request(body:unknown,purpose:'verify'|'reset',userId?:string){
  const data=input.object(body);const address=purpose==='reset'?input.email(data.email):null;
  await this.db.transaction(async client=>{
   const u=await client.query('SELECT id,email FROM users WHERE status=$1 AND '+(userId?'id=$2':'lower(email)=$2')+' FOR UPDATE',['active',userId||address]);
   if(u.rowCount)await this.issue(client,u.rows[0].id,u.rows[0].email,purpose);
  });
  return {message:'Falls das aktive Konto existiert, wurde eine Nachricht vorbereitet.'};
 }
 async confirm(body:unknown,purpose:'verify'|'reset'){
  const data=input.object(body);if(typeof data.token!=='string'||!/^[-\w]{43}$/.test(data.token))throw new BadRequestException('Ungültiger oder abgelaufener Link.');
  const hashed=purpose==='reset'?await bcrypt.hash(input.password(data.password),12):null;
  return this.db.transaction(async client=>{
   const candidate=await client.query('SELECT user_id FROM identity_tokens WHERE token_hash=$1 AND purpose=$2',[digest(data.token as string),purpose]);if(!candidate.rowCount)throw new BadRequestException('Ungültiger oder abgelaufener Link.');await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[candidate.rows[0].user_id]);
   const token=await client.query('SELECT id,user_id FROM identity_tokens WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[digest(data.token as string),purpose]);
   if(!token.rowCount)throw new BadRequestException('Ungültiger, bereits verwendeter oder abgelaufener Link.');
   const u=token.rows[0];await client.query('UPDATE identity_tokens SET used_at=now() WHERE id=$1',[u.id]);
   if(purpose==='reset'){
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hashed,u.user_id]);
    await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1',[u.user_id]);
    await client.query("UPDATE identity_tokens SET used_at=now() WHERE user_id=$1 AND purpose='reset' AND used_at IS NULL",[u.user_id]);
   }else await client.query('UPDATE users SET verified_at=now() WHERE id=$1',[u.user_id]);
   return {ok:true};
  });
 }
 async status(userId:string){const jobs=await this.db.query('SELECT id,status,attempts,last_error_code,created_at,sent_at FROM mail_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId]);return {configured:this.configured(),development:process.env.NODE_ENV!=='production',jobs:jobs.rows};}
 async devMailbox(userId:string){if(process.env.NODE_ENV==='production')throw new NotFoundException();const result=await this.db.query('SELECT id,payload_encrypted FROM mail_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',[userId]);return result.rows.map(r=>({id:r.id,...decryptMail(r.payload_encrypted)}));}
 private async deliver(){
  if(this.working)return;this.working=true;
  try{
   await this.db.query("UPDATE mail_jobs SET status='failed',attempts=3,last_error_code='MESSAGE_EXPIRED' WHERE status IN ('queued','failed') AND ((user_id IS NOT NULL AND created_at<now()-interval '30 minutes') OR created_at<now()-interval '30 days')");
   const job=await this.db.transaction(async client=>{
    const q=await client.query("SELECT id,payload_encrypted FROM mail_jobs WHERE status IN ('queued','failed') AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if(!q.rowCount)return null;await client.query("UPDATE mail_jobs SET status='sending',attempts=attempts+1 WHERE id=$1",[q.rows[0].id]);return q.rows[0];
   });
   if(!job)return;
   try{
    const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,secure:process.env.SMTP_PORT==='465',requireTLS:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},tls:{rejectUnauthorized:true},connectionTimeout:10000,socketTimeout:10000});
    await transport.sendMail({...decryptMail(job.payload_encrypted),from:process.env.SMTP_FROM,messageId:`<${job.id}@surveystudio.local>`});
    await this.db.query("UPDATE mail_jobs SET status='sent',sent_at=now(),last_error_code=NULL WHERE id=$1",[job.id]);
   }catch{await this.db.query("UPDATE mail_jobs SET status='failed',last_error_code='DELIVERY_FAILED' WHERE id=$1",[job.id]);}
  }catch{/* Status remains observable; never log message contents or credentials. */}finally{this.working=false;}
 }
}
@Controller('auth')
export class IdentityController {
 constructor(private readonly identity:IdentityService){}
 @Public() @Post('password-reset/request') reset(@Body() body:unknown){return this.identity.request(body,'reset');}
 @Public() @Post('password-reset/confirm') resetConfirm(@Body() body:unknown){return this.identity.confirm(body,'reset');}
 @Post('verification/request') verifyRequest(@CurrentUser() viewer:Viewer){return this.identity.request({},'verify',viewer.id);}
 @Public() @Post('verification/confirm') verify(@Body() body:unknown){return this.identity.confirm(body,'verify');}
 @Get('mail-status') status(@CurrentUser() viewer:Viewer){return this.identity.status(viewer.id);}
 @Get('development-mailbox') mailbox(@CurrentUser() viewer:Viewer){return this.identity.devMailbox(viewer.id);}
}
