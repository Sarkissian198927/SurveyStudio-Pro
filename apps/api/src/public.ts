import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Injectable, NotFoundException, Param, Post, UnprocessableEntityException,ForbiddenException } from '@nestjs/common';
import { canonicalJson, cleanAnswers, SurveyDraft,validateConsent,validateDraft, validateAnswers } from '@surveystudio/shared';
import { createHash } from 'node:crypto';
import { Database } from './database';
import { Public } from './auth';
import * as input from './input';
@Injectable()
export class PublicSurveyService {
 constructor(private readonly db:Database) {}
 private active(p:{state:string;opens_at:Date|null;closes_at:Date|null;document?:SurveyDraft}){if(process.env.NODE_ENV==='production'&&p.document&&!validateDraft(p.document,true,true).ok)return false;const now=Date.now();return p.state==='active'&&(!p.opens_at||+new Date(p.opens_at)<=now)&&(!p.closes_at||+new Date(p.closes_at)>now);}
 async publication(slug:string,requireActive=true) {
  if(typeof slug!=='string'||!/^[-\w]{16,80}$/.test(slug))throw new NotFoundException('Umfrage nicht gefunden.');
  const result=await this.db.query(`SELECT p.*,v.document FROM publications p JOIN survey_versions v ON v.id=p.survey_version_id WHERE p.slug=$1`,[slug]);
  const p=result.rows[0];if(!p||requireActive&&!this.active(p))throw new NotFoundException('Diese Umfrage nimmt derzeit keine Antworten entgegen.');return p;
 }
 async get(slug:string){return {document:(await this.publication(slug)).document};}
 async submit(slug:string,body:unknown) {
  const p=await this.publication(slug,false),data=input.object(body),key=input.uuid(data.idempotencyKey);
  const checked=validateAnswers(p.document as SurveyDraft,data.answers as Record<string,unknown>);
  if(!checked.ok)throw new UnprocessableEntityException({message:'Bitte Eingaben korrigieren.',errors:checked.errors});
  if(!validateConsent(p.document,data.consent))throw new UnprocessableEntityException('Bitte den versionsgebundenen Datenschutzhinweis bestätigen.');
  const personal=p.document.privacy.mode!=='anonymous';
  if(personal&&(typeof data.inviteToken!=='string'||!/^[-\w]{43}$/.test(data.inviteToken)))throw new UnprocessableEntityException('Diese Umfrage verlangt eine persönliche Einladung.');
  if(!personal&&data.inviteToken!==undefined)throw new UnprocessableEntityException('Anonyme Antworten dürfen keinen Einladungsschlüssel enthalten.');
  const answers=cleanAnswers(p.document,data.answers as Record<string,unknown>);
  const sha=createHash('sha256').update(canonicalJson(answers)).digest('hex');
  return this.db.transaction(async client=>{
   const locked=(await client.query('SELECT * FROM publications WHERE id=$1 FOR UPDATE',[p.id])).rows[0];
   const invitation=personal?(await client.query('SELECT id,invitee_id,expires_at,revoked_at FROM invitations WHERE token_hash=$1 AND publication_id=$2 FOR UPDATE',[createHash('sha256').update(data.inviteToken as string).digest('hex'),p.id])).rows[0]:null;
   if(personal&&!invitation)throw new ForbiddenException('Einladung nicht gültig.');
   const existing=await client.query('SELECT id,answer_sha256 FROM response_sessions WHERE publication_id=$1 AND idempotency_key=$2',[p.id,key]);
   if(existing.rowCount){if(personal){const link=await client.query('SELECT 1 FROM participant_links WHERE session_id=$1 AND invitee_id=$2',[existing.rows[0].id,invitation.invitee_id]);if(!link.rowCount)throw new ForbiddenException();}if(existing.rows[0].answer_sha256!==sha)throw new ConflictException('Diese Abgabe-ID gehört zu einer anderen Antwort.');return {ok:true,submissionId:existing.rows[0].id,duplicate:true};}
   if(invitation){if(invitation.revoked_at||+new Date(invitation.expires_at)<Date.now())throw new ForbiddenException('Einladung abgelaufen.');const prior=await client.query('SELECT 1 FROM participant_links WHERE invitee_id=$1 AND publication_id=$2',[invitation.invitee_id,p.id]);if(prior.rowCount)throw new ConflictException('Diese Einladung wurde bereits beantwortet.');}
   if(!locked||!this.active({...locked,document:p.document}))throw new ConflictException('Die Umfrage ist pausiert, geschlossen oder außerhalb des Teilnahmezeitraums.');
   if(locked.max_responses){const count=await client.query('SELECT count(*)::int n FROM response_sessions WHERE publication_id=$1',[p.id]);if(count.rows[0].n>=locked.max_responses)throw new ConflictException('Die maximale Anzahl an Antworten ist erreicht.');}
   const saved=await client.query(`INSERT INTO response_sessions(organization_id,publication_id,survey_version_id,idempotency_key,answer_sha256,notice_revision,consent_given) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[p.organization_id,p.id,p.survey_version_id,key,sha,p.document.privacy.noticeRevision||null,p.document.privacy.requireConsent?true:null]);
   await client.query(`INSERT INTO response_items(session_id,question_key,answer_json) SELECT $1,key,value FROM jsonb_each($2::jsonb) WHERE value NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb)`,[saved.rows[0].id,JSON.stringify(answers)]);
   if(invitation)await client.query('INSERT INTO participant_links(session_id,invitee_id,publication_id,invitation_id) VALUES($1,$2,$3,$4)',[saved.rows[0].id,invitation.invitee_id,p.id,invitation.id]);
   return {ok:true,submissionId:saved.rows[0].id,duplicate:false};
  });
 }
}
@Public() @Controller('public/s')
export class PublicController {
 constructor(private readonly service:PublicSurveyService) {}
 @Get(':slug') get(@Param('slug') slug:string){return this.service.get(slug);}
 @Post(':slug/responses') @HttpCode(201) submit(@Param('slug') slug:string,@Body() body:unknown){return this.service.submit(slug,body);}
}
