import { Body,ConflictException,Controller,Delete,ForbiddenException,Injectable,Post,Req,UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { createHash,randomBytes } from 'node:crypto';
import { canonicalJson,cleanAnswers,validateAnswers,validateDraft,validateConsent,type SurveyDraft } from '@surveystudio/shared';
import { Database } from './database';
import { ProjectService } from './projects';
import { CurrentUser,Public,Viewer } from './session';
import * as input from './input';
const hash=(x:string)=>createHash('sha256').update(x).digest('hex');
@Injectable()
export class SyncService {
 constructor(private readonly db:Database,private readonly projects:ProjectService){}
 async issue(userId:string){const token=randomBytes(32).toString('base64url');const result=await this.db.query('INSERT INTO device_tokens(user_id,token_hash) VALUES($1,$2) RETURNING id,expires_at',[userId,hash(token)]);return {...result.rows[0],token};}
 async revoke(userId:string){await this.db.query('UPDATE device_tokens SET revoked_at=now() WHERE user_id=$1',[userId]);return {ok:true};}
 async push(authorization:unknown,body:unknown){
  if(typeof authorization!=='string'||!/^Bearer [-\w]{43}$/.test(authorization))throw new UnauthorizedException('Gerätezugang fehlt.');
  const token=await this.db.query("SELECT t.user_id FROM device_tokens t JOIN users u ON u.id=t.user_id WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND u.status='active'"+(process.env.NODE_ENV==='production'?' AND u.verified_at IS NOT NULL':''),[hash(authorization.slice(7))]);
  if(!token.rowCount)throw new UnauthorizedException('Gerätezugang abgelaufen oder widerrufen.');
  const userId:string=token.rows[0].user_id,data=input.object(body),projectId=input.uuid(data.targetProjectId);
  if(!Array.isArray(data.operations)||data.operations.length>500)throw new ConflictException('Maximal 500 Vorgänge pro Synchronisation.');
  return this.db.transaction(async c=>{
   await c.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[projectId]);await this.projects.authorize(projectId,userId,'manage',c);
   const org=(await c.query('SELECT organization_id FROM projects WHERE id=$1',[projectId])).rows[0].organization_id;
   const applied:string[]=[];
   for(const item of data.operations as unknown[]){
    const op=input.object(item),id=input.uuid(op.id),operationId=input.text(op.operationId,'Vorgangs-ID',128),payloadHash=hash(canonicalJson(op));
    const previous=await c.query('SELECT payload_hash FROM sync_operations WHERE user_id=$1 AND operation_id=$2',[userId,operationId]);
    if(previous.rowCount){if(previous.rows[0].payload_hash!==payloadHash)throw new ConflictException('Vorgangs-ID wurde verändert.');applied.push(operationId);continue;}
    const d=input.object(op.document);
    if(op.kind==='survey'){
     const document=d.document as SurveyDraft,checked=validateDraft(document);if(!checked.ok)throw new ConflictException('Ungültiger lokaler Fragebogen: '+checked.errors.join(' · '));
     const s=await c.query('SELECT s.project_id,s.state,d.revision FROM surveys s JOIN survey_drafts d ON d.survey_id=s.id WHERE s.id=$1 FOR UPDATE',[id]);
     if(s.rowCount){if(s.rows[0].project_id!==projectId)throw new ForbiddenException('Lokale ID gehört zu einem anderen Projekt.');if(s.rows[0].revision!==op.baseRevision)throw new ConflictException('Entwurfskonflikt: Server- und lokale Revision unterscheiden sich. Lokale Daten behalten.');await c.query('UPDATE survey_drafts SET document=$1::jsonb,revision=revision+1,updated_at=now() WHERE survey_id=$2',[JSON.stringify(document),id]);await c.query('UPDATE surveys SET title=$1,updated_at=now() WHERE id=$2',[document.metadata.title,id]);const state=(d.survey as {state?:string}|undefined)?.state;if(state==='archived'){await c.query("UPDATE surveys SET state='archived' WHERE id=$1",[id]);await c.query("UPDATE publications SET state='closed' WHERE survey_id=$1",[id]);}}
     else{if(op.baseRevision!==0)throw new ConflictException('Lokaler Anfangsstand fehlt.');await c.query('INSERT INTO surveys(id,organization_id,project_id,title) VALUES($1,$2,$3,$4)',[id,org,projectId,document.metadata.title]);await c.query('INSERT INTO survey_drafts(survey_id,document) VALUES($1,$2::jsonb)',[id,JSON.stringify(document)]);}
    }else if(op.kind==='version'){
     const surveyId=input.uuid(d.surveyId),document=d.document as SurveyDraft,checked=validateDraft(document,true);if(!checked.ok)throw new ConflictException('Ungültige lokale Version.');
     const s=await c.query('SELECT 1 FROM surveys WHERE id=$1 AND project_id=$2',[surveyId,projectId]);if(!s.rowCount)throw new ForbiddenException();
     const sha=hash(canonicalJson(document)),existing=await c.query('SELECT survey_id,schema_sha256 FROM survey_versions WHERE id=$1',[id]);
     if(existing.rowCount){if(existing.rows[0].survey_id!==surveyId||existing.rows[0].schema_sha256!==sha)throw new ConflictException('Versions-ID kollidiert.');}
     else{if(!Number.isSafeInteger(d.versionNo)||Number(d.versionNo)<1)throw new ConflictException('Versionsnummer ungültig.');const number=await c.query('SELECT 1 FROM survey_versions WHERE survey_id=$1 AND version_no=$2',[surveyId,d.versionNo]);if(number.rowCount)throw new ConflictException('Versionsnummer bereits belegt.');await c.query('INSERT INTO survey_versions(id,organization_id,survey_id,version_no,document,schema_sha256) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,org,surveyId,d.versionNo,JSON.stringify(document),sha]);}
    }else if(op.kind==='publication'){
     const surveyId=input.uuid(d.surveyId),versionId=input.uuid(d.versionId),slug=input.text(d.slug,'Lokaler Link',80);if(!/^[-\w]{16,80}$/.test(slug))throw new ConflictException('Link ungültig.');
     const s=await c.query('SELECT 1 FROM survey_versions v JOIN surveys s ON s.id=v.survey_id WHERE v.id=$1 AND s.id=$2 AND s.project_id=$3',[versionId,surveyId,projectId]);if(!s.rowCount)throw new ForbiddenException();
     const existing=await c.query('SELECT survey_id,survey_version_id FROM publications WHERE id=$1',[id]);if(existing.rowCount){if(existing.rows[0].survey_id!==surveyId||existing.rows[0].survey_version_id!==versionId)throw new ConflictException('Veröffentlichungs-ID kollidiert.');if(d.state==='paused'||d.state==='closed')await c.query('UPDATE publications SET state=$1 WHERE id=$2',[d.state,id]);}
     else await c.query("INSERT INTO publications(id,organization_id,survey_id,survey_version_id,slug,state) VALUES($1,$2,$3,$4,$5,'paused')",[id,org,surveyId,versionId,slug]);
    }else if(op.kind==='response'){
     const pubId=input.uuid(d.publicationId),versionId=input.uuid(d.versionId),idempotencyKey=input.uuid(d.idempotencyKey);
     const p=await c.query('SELECT v.document,p.survey_version_id FROM publications p JOIN surveys s ON s.id=p.survey_id JOIN survey_versions v ON v.id=p.survey_version_id WHERE p.id=$1 AND s.project_id=$2',[pubId,projectId]);if(!p.rowCount||p.rows[0].survey_version_id!==versionId)throw new ForbiddenException();
     if(p.rows[0].document.privacy.mode!=='anonymous')throw new ConflictException('Lokale Synchronisation unterstützt derzeit nur anonyme Fragebögen.');
     if(!validateConsent(p.rows[0].document,d.consent))throw new ConflictException('Lokale Bestätigung fehlt.');
     const checked=validateAnswers(p.rows[0].document,d.answers as Record<string,unknown>);if(!checked.ok)throw new ConflictException('Ungültige lokale Antworten.');const answers=cleanAnswers(p.rows[0].document,d.answers as Record<string,unknown>),sha=hash(canonicalJson(answers));
     const existing=await c.query('SELECT answer_sha256 FROM response_sessions WHERE publication_id=$1 AND idempotency_key=$2',[pubId,idempotencyKey]);
     if(existing.rowCount){if(existing.rows[0].answer_sha256!==sha)throw new ConflictException('Antwortkonflikt bei gleicher Abgabe-ID.');}
     else{await c.query('INSERT INTO response_sessions(id,organization_id,publication_id,survey_version_id,idempotency_key,answer_sha256,notice_revision,consent_given) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,org,pubId,versionId,idempotencyKey,sha,p.rows[0].document.privacy.noticeRevision||null,p.rows[0].document.privacy.requireConsent?true:null]);for(const [key,value] of Object.entries(answers))if(value!==undefined&&value!==null&&value!=='')await c.query('INSERT INTO response_items(session_id,question_key,answer_json) VALUES($1,$2,$3::jsonb)',[id,key,JSON.stringify(value)]);}
    }else throw new ConflictException('Unbekannter Synchronisationsvorgang.');
    await c.query('INSERT INTO sync_operations(user_id,operation_id,payload_hash) VALUES($1,$2,$3)',[userId,operationId,payloadHash]);applied.push(operationId);
   }
   return {applied};
  });
 }
}
@Controller()
export class SyncController {
 constructor(private readonly sync:SyncService){}
 @Post('auth/device-token') issue(@CurrentUser() user:Viewer){return this.sync.issue(user.id);}
 @Delete('auth/device-token') revoke(@CurrentUser() user:Viewer){return this.sync.revoke(user.id);}
 @Public() @Post('sync/push') push(@Req() req:Request,@Body() body:unknown){return this.sync.push(req.headers.authorization,body);}
}
