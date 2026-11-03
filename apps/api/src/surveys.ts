import { calculateResults } from '@surveystudio/analytics';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { createDraft, SurveyDraft, validateDraft } from '@surveystudio/shared';
import { createHash, randomBytes } from 'node:crypto';
import { CurrentUser, Viewer } from './auth';
import { Database } from './database';
import { ProjectService } from './projects';
const isUuid=(id:string)=>/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
@Injectable()
export class SurveyService {
 constructor(private readonly db:Database,private readonly projects:ProjectService) {}
 async access(id:string,userId:string,write=false) {
   if(!isUuid(id)) throw new BadRequestException('Ungültige Umfrage-ID.');
   const q=await this.db.query('SELECT id,project_id,organization_id,title,state FROM surveys WHERE id=$1',[id]);
   if(!q.rowCount) throw new NotFoundException('Umfrage nicht gefunden.');
   await this.projects.role(q.rows[0].project_id,userId,write);
   return q.rows[0];
 }
 async list(projectId:string,userId:string) {
   if(!isUuid(projectId)) throw new BadRequestException('Ungültige Projekt-ID.');
   await this.projects.role(projectId,userId);
   const q=await this.db.query(`SELECT s.id,s.project_id,s.title,s.state,s.created_at,s.updated_at,d.revision,
    (SELECT count(*)::integer FROM response_sessions rs JOIN publications p ON p.id=rs.publication_id WHERE p.survey_id=s.id) AS response_count
    FROM surveys s JOIN survey_drafts d ON d.survey_id=s.id WHERE s.project_id=$1 ORDER BY s.updated_at DESC`,[projectId]);
   return q.rows;
 }
 async create(projectId:string,title:string,userId:string) {
   if(!isUuid(projectId)) throw new BadRequestException('Ungültige Projekt-ID.');
   await this.projects.role(projectId,userId,true);
   if(typeof title!=='string' || !title.trim() || title.length>160) throw new BadRequestException('Titel fehlt oder ist zu lang.');
   const org=await this.db.query('SELECT organization_id FROM projects WHERE id=$1',[projectId]);
   const document=createDraft(title.trim());
   return this.db.transaction(async client=>{
     const result=await client.query('INSERT INTO surveys(project_id,organization_id,title) VALUES($1,$2,$3) RETURNING *',[projectId,org.rows[0].organization_id,title.trim()]);
     await client.query('INSERT INTO survey_drafts(survey_id,document) VALUES($1,$2::jsonb)',[result.rows[0].id,JSON.stringify(document)]);
     await client.query('INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) VALUES($1,$2,$3,$4)',[org.rows[0].organization_id,userId,'survey.created',result.rows[0].id]);
     return {survey:result.rows[0],revision:1,document};
   });
 }
 async get(id:string,userId:string) {
   const survey=await this.access(id,userId);
   const draft=await this.db.query('SELECT revision,document,updated_at FROM survey_drafts WHERE survey_id=$1',[id]);
   const publication=await this.db.query(`SELECT id,slug,state,opens_at,closes_at,max_responses,created_at FROM publications WHERE survey_id=$1 ORDER BY created_at DESC LIMIT 1`,[id]);
   return {survey,revision:draft.rows[0].revision,document:draft.rows[0].document,publication:publication.rows[0]||null};
 }
 async save(id:string,userId:string,body:any) {
   const survey=await this.access(id,userId,true);
   if(survey.state==='archived')throw new ConflictException('Archivierte Umfragen können nicht bearbeitet werden.');
   if(!Number.isSafeInteger(body?.expectedRevision) || body.expectedRevision<1) throw new BadRequestException('expectedRevision ist erforderlich.');
   const document:SurveyDraft=body?.document;
   const result=validateDraft(document);
   if(!result.ok) throw new BadRequestException({message:'Ungültiger Fragebogen',errors:result.errors});
   for(const field of ['backgroundImage','logoImage'] as const){const url=document?.theme?.[field];if(typeof url==='string'&&url.startsWith('/api/v1/public/assets/')){const asset=await this.db.query('SELECT 1 FROM assets WHERE id=$1 AND project_id=$2',[url.slice('/api/v1/public/assets/'.length),survey.project_id]);if(!asset.rowCount)throw new ForbiddenException('Bild gehört zu einem anderen Projekt.');}}
   const updated=await this.db.transaction(async client=>{
     await client.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);
     await this.projects.role(survey.project_id,userId,true);
     await client.query('INSERT INTO survey_history(survey_id,revision,document,author_id) SELECT survey_id,revision,document,$2 FROM survey_drafts WHERE survey_id=$1 ON CONFLICT DO NOTHING',[id,userId]);
     const q=await client.query(`UPDATE survey_drafts SET document=$1::jsonb, revision=revision+1, updated_at=now()
       WHERE survey_id=$2 AND revision=$3 RETURNING revision,updated_at`,[JSON.stringify(document),id,body.expectedRevision]);
     if(!q.rowCount) return null;
     await client.query('INSERT INTO survey_history(survey_id,revision,document,author_id) VALUES($1,$2,$3::jsonb,$4)',[id,q.rows[0].revision,JSON.stringify(document),userId]);
     await client.query('UPDATE surveys SET title=$1,updated_at=now(),privacy_mode=$3 WHERE id=$2',[document.metadata.title,id,document.privacy.mode]);
     return q.rows[0];
   });
   if(!updated) throw new ConflictException('Der Entwurf wurde zwischenzeitlich geändert. Bitte neu laden.');
   return updated;
 }
 async publish(id:string,userId:string) {
   const survey=await this.access(id,userId,true);
   return this.db.transaction(async client=>{
     await client.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);
     await this.projects.role(survey.project_id,userId,true);
     if(survey.state==='archived')throw new ConflictException('Archivierte Umfragen können nicht veröffentlicht werden.');
     const {rows}=await client.query('SELECT document FROM survey_drafts WHERE survey_id=$1 FOR UPDATE',[id]);
     const document:SurveyDraft=rows[0].document;
     const checked=validateDraft(document,true,process.env.NODE_ENV==='production');
     if(!checked.ok)throw new BadRequestException({message:'Umfrage nicht veröffentlichbar',errors:checked.errors});
     const hash=createHash('sha256').update(JSON.stringify(document)).digest('hex');
     const latest=await client.query('SELECT COALESCE(max(version_no),0)::integer AS version_no FROM survey_versions WHERE survey_id=$1',[id]);
     const version=await client.query(`INSERT INTO survey_versions(organization_id,survey_id,version_no,document,schema_sha256)
       VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id,version_no`,[survey.organization_id,id,latest.rows[0].version_no+1,JSON.stringify(document),hash]);
     await client.query('UPDATE publications SET state=$1 WHERE survey_id=$2 AND state=$3',['closed',id,'active']);
     const slug=randomBytes(18).toString('base64url');
     await client.query(`INSERT INTO publications(organization_id,survey_id,survey_version_id,slug) VALUES($1,$2,$3,$4)`,[survey.organization_id,id,version.rows[0].id,slug]);
     await client.query('UPDATE surveys SET state=$1,updated_at=now() WHERE id=$2',['published',id]);
     await client.query('INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) VALUES($1,$2,$3,$4)',[survey.organization_id,userId,'survey.published',id]);
     return {slug,versionNo:version.rows[0].version_no,url:`${process.env.PUBLIC_WEB_ORIGIN||'http://localhost:5173'}/s/${slug}`};
   });
 }
 async results(id:string,userId:string) {
   const survey=await this.access(id,userId);
   const role=await this.projects.role(survey.project_id,userId);
   const latest=await this.db.query('SELECT document FROM survey_versions WHERE survey_id=$1 ORDER BY version_no DESC LIMIT 1',[id]);
   if(!latest.rowCount) return {totalResponses:0,questions:[]};
   // Current MVP aggregates the newest survey version only: comparisons across revisions are a separate feature.
   const version=await this.db.query('SELECT id FROM survey_versions WHERE survey_id=$1 ORDER BY version_no DESC LIMIT 1',[id]);
   const count=await this.db.query('SELECT count(*)::integer AS total FROM response_sessions WHERE survey_version_id=$1',[version.rows[0].id]);
   if(['viewer','guest'].includes(role) && count.rows[0].total<5) return {totalResponses:0,questions:[],scope:'latest_version',suppressed:true};
   const values=await this.db.query(`SELECT ri.question_key,ri.answer_json FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id
     WHERE rs.survey_version_id=$1`,[version.rows[0].id]);
   return {...calculateResults(latest.rows[0].document,values.rows,count.rows[0].total),scope:'latest_version'};
 }
}
@Controller('surveys')
export class SurveyController {
 constructor(private readonly surveys:SurveyService) {}
 @Get() list(@CurrentUser() viewer:Viewer,@Query('projectId') projectId:string) {return this.surveys.list(projectId,viewer.id);}
 @Post() create(@CurrentUser() viewer:Viewer,@Body() body:any) {return this.surveys.create(body?.projectId,body?.title,viewer.id);}
 @Get(':id') get(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.surveys.get(id,viewer.id);}
 @Patch(':id/draft') save(@CurrentUser() viewer:Viewer,@Param('id') id:string,@Body() body:any) {return this.surveys.save(id,viewer.id,body);}
 @Post(':id/publish') publish(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.surveys.publish(id,viewer.id);}
 @Get(':id/results') results(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.surveys.results(id,viewer.id);}
}
