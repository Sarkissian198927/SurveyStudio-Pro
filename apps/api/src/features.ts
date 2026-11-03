import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query, Res,OnModuleInit,OnModuleDestroy } from '@nestjs/common';
import { createHash,randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir,stat,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { SurveyDraft } from '@surveystudio/shared';
import { Database } from './database';
import { SurveyService } from './surveys';
import { ProjectService } from './projects';
import { CurrentUser,Public,Viewer } from './session';
import * as input from './input';

const hash=(x:string)=>createHash('sha256').update(x).digest('hex');
const csvCell=(value:unknown)=>{let s=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value==='string'&&/^(?:\s*[=+@\-]|[\t\r])/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
type Results={totalResponses:number;scope:string;versionId?:string;versionNo?:number;suppressed?:boolean;questions:Record<string,unknown>[];timeline?:{date:string;count:number}[]};
@Injectable()
export class FeatureService implements OnModuleInit,OnModuleDestroy {
 private worker?:NodeJS.Timeout;
 onModuleInit(){this.worker=setInterval(()=>void this.recoverExports().catch(()=>{}),10000);this.worker.unref();}
 onModuleDestroy(){if(this.worker)clearInterval(this.worker);}
 private async recoverExports(){await this.db.query("UPDATE export_jobs SET status='queued' WHERE status='running' AND created_at<now()-interval '15 minutes'");const jobs=await this.db.query("SELECT id FROM export_jobs WHERE status='queued' AND expires_at>now() ORDER BY created_at LIMIT 1");if(jobs.rowCount)await this.generateExport(jobs.rows[0].id);const expired=await this.db.query("SELECT id,file_path FROM export_jobs WHERE expires_at<now() AND file_path IS NOT NULL");for(const job of expired.rows){const dir=process.env.EXPORT_DIR||'/tmp/surveystudio-exports';if(job.file_path===join(dir,`${job.id}.csv`)||job.file_path===join(dir,`${job.id}.xlsx`)||job.file_path===join(dir,`${job.id}.pdf`)){await unlink(job.file_path).catch(()=>{});await this.db.query('UPDATE export_jobs SET file_path=NULL WHERE id=$1',[job.id]);}}}

 constructor(private readonly db:Database,private readonly surveys:SurveyService,private readonly projects:ProjectService){}
 async admin(id:string,userId:string){const survey=await this.surveys.access(id,userId);if(await this.projects.role(survey.project_id,userId)!=='owner')throw new ForbiddenException('Nur Projekt-Owner dürfen Rohdaten, Löschung und Freigaben verwalten.');return survey;}
 async metadata(id:string,userId:string,body:unknown){
  const survey=await this.surveys.access(id,userId,true),data=input.object(body);
  if(data.state!==undefined&&!['draft','archived'].includes(String(data.state)))throw new BadRequestException('Ungültiger Status.');
  if(data.title!==undefined){const current=await this.surveys.get(id,userId);current.document.metadata.title=input.text(data.title,'Titel');await this.surveys.save(id,userId,{expectedRevision:data.expectedRevision,document:current.document});}
  if(data.state!==undefined)await this.db.transaction(async c=>{
   await c.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);await this.projects.role(survey.project_id,userId,true);
   await c.query('UPDATE surveys SET state=$1,updated_at=now() WHERE id=$2',[data.state,id]);
   if(data.state==='archived')await c.query("UPDATE publications SET state='closed' WHERE survey_id=$1",[id]);
  });return this.surveys.get(id,userId);
 }
 async duplicate(id:string,userId:string){
  const existing=await this.surveys.get(id,userId);await this.projects.role(existing.survey.project_id,userId,true);
  const document=structuredClone(existing.document) as SurveyDraft;document.metadata.title=(document.metadata.title+' (Kopie)').slice(0,160);
  const created=await this.surveys.create(existing.survey.project_id,document.metadata.title,userId);
  await this.surveys.save(created.survey.id,userId,{expectedRevision:1,document});return this.surveys.get(created.survey.id,userId);
 }
 async versions(id:string,userId:string){await this.surveys.access(id,userId);return (await this.db.query('SELECT id,version_no,published_at,schema_sha256 FROM survey_versions WHERE survey_id=$1 ORDER BY version_no DESC',[id])).rows;}
 async publication(id:string,userId:string,body:unknown){
  const survey=await this.surveys.access(id,userId,true),data=input.object(body);
  if(!['active','paused','closed'].includes(String(data.state)))throw new BadRequestException('Status muss active, paused oder closed sein.');
  const parse=(v:unknown)=>v==null||v===''?null:typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v):(()=>{throw new BadRequestException('Ungültiger Zeitpunkt.');})();
  const opens=parse(data.opensAt),closes=parse(data.closesAt);
  if(opens&&closes&&closes<=opens)throw new BadRequestException('Ende muss nach Beginn liegen.');
  const limit=data.maxResponses??null;if(limit!==null&&(!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>10000000))throw new BadRequestException('Ungültiges Antwortlimit.');
  return this.db.transaction(async c=>{
   await c.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);
   if(survey.state==='archived'&&data.state==='active')throw new ConflictException('Archivierte Umfragen zuerst wiederherstellen.');
   const p=await c.query('SELECT id FROM publications WHERE survey_id=$1 ORDER BY created_at DESC LIMIT 1',[id]);if(!p.rowCount)throw new NotFoundException('Noch nicht veröffentlicht.');
   await c.query('UPDATE publications SET state=$1,opens_at=$2,closes_at=$3,max_responses=$4 WHERE id=$5',[data.state,opens,closes,limit,p.rows[0].id]);
   await c.query('UPDATE surveys SET state=$1 WHERE id=$2',[data.state==='active'?'published':'paused',id]);return {ok:true};
  });
 }
 async history(id:string,userId:string){await this.surveys.access(id,userId,true);return (await this.db.query('SELECT h.id,h.revision,h.created_at,u.display_name FROM survey_history h LEFT JOIN users u ON u.id=h.author_id WHERE survey_id=$1 ORDER BY revision DESC LIMIT 100',[id])).rows;}
 async restore(id:string,userId:string,revision:number,expectedRevision:number){await this.surveys.access(id,userId,true);if(!Number.isInteger(revision))throw new BadRequestException('Ungültige Revision.');const h=await this.db.query('SELECT document FROM survey_history WHERE survey_id=$1 AND revision=$2',[id,revision]);if(!h.rowCount)throw new NotFoundException();return this.surveys.save(id,userId,{expectedRevision,document:h.rows[0].document});}
 async comments(id:string,userId:string){await this.surveys.access(id,userId);return (await this.db.query('SELECT c.id,c.body,c.resolved,c.created_at,u.display_name FROM survey_comments c JOIN users u ON u.id=c.author_id WHERE survey_id=$1 ORDER BY created_at',[id])).rows;}
 async comment(id:string,userId:string,body:unknown){await this.surveys.access(id,userId,true);const text=input.text(input.object(body).body,'Kommentar',4000);return (await this.db.query('INSERT INTO survey_comments(survey_id,author_id,body) VALUES($1,$2,$3) RETURNING id,body,resolved,created_at',[id,userId,text])).rows[0];}
 async resolveComment(id:string,userId:string,commentId:string){await this.surveys.access(id,userId,true);await this.db.query('UPDATE survey_comments SET resolved=true WHERE survey_id=$1 AND id=$2',[id,input.uuid(commentId)]);return {ok:true};}
 async results(id:string,userId:string,versionId?:string):Promise<Results>{const survey=await this.surveys.access(id,userId);const role=await this.projects.role(survey.project_id,userId);return this.aggregate(id,versionId,['viewer','guest'].includes(role)?5:0);}
 async aggregate(surveyId:string,versionId?:string,minimum=0):Promise<Results>{
  if(versionId)input.uuid(versionId);
  const v=(await this.db.query('SELECT id,version_no,document FROM survey_versions WHERE survey_id=$1'+(versionId?' AND id=$2':'')+' ORDER BY version_no DESC LIMIT 1',versionId?[surveyId,versionId]:[surveyId])).rows[0];
  if(!v)return {totalResponses:0,scope:'version',questions:[]};
  // A single snapshot keeps all counts consistent if a submission arrives during aggregation.
  return this.db.transaction(async c=>{
   await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const total=(await c.query('SELECT count(*)::int n FROM response_sessions WHERE survey_version_id=$1',[v.id])).rows[0].n;
   if(minimum&&total<minimum)return {totalResponses:0,questions:[],scope:'version',suppressed:true};
   const document=v.document as SurveyDraft,questions:Record<string,unknown>[]=[];
   for(const q of document.questions){
    const count=(await c.query(`SELECT count(*)::int n FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id WHERE rs.survey_version_id=$1 AND ri.question_key=$2`,[v.id,q.key])).rows[0].n;
    const result:Record<string,unknown>={key:q.key,type:q.type,label:q.label,answered:count};
    if(minimum&&count<minimum){questions.push({key:q.key,type:q.type,label:q.label,suppressed:true});continue;}
    if(['number','rating','nps','slider'].includes(q.type)){
     const stats=(await c.query(`SELECT avg((ri.answer_json#>>'{}')::double precision) mean,percentile_cont(0.5) WITHIN GROUP(ORDER BY (ri.answer_json#>>'{}')::double precision) median,stddev_pop((ri.answer_json#>>'{}')::double precision) stddev,min((ri.answer_json#>>'{}')::double precision) min,max((ri.answer_json#>>'{}')::double precision) max FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id WHERE rs.survey_version_id=$1 AND ri.question_key=$2`,[v.id,q.key])).rows[0];Object.assign(result,stats);if(q.type==='nps')result.nps=(await c.query("SELECT round(100*avg(CASE WHEN (ri.answer_json#>>'{}')::float>=9 THEN 1 WHEN (ri.answer_json#>>'{}')::float<=6 THEN -1 ELSE 0 END))::int nps FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id WHERE rs.survey_version_id=$1 AND ri.question_key=$2",[v.id,q.key])).rows[0].nps;if(minimum){delete result.min;delete result.max;delete result.stddev;}
    }else if(q.type==='matrix_single'||q.type==='matrix_multi'){
     const values=(await c.query(`SELECT cell.key row_key,o.value->>'value' option_key,count(*) FILTER(WHERE cell.value=to_jsonb(o.value->>'value') OR cell.value @> jsonb_build_array(o.value->>'value'))::int count FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id CROSS JOIN LATERAL jsonb_each(ri.answer_json) cell CROSS JOIN jsonb_array_elements($3::jsonb) o(value) WHERE rs.survey_version_id=$1 AND ri.question_key=$2 GROUP BY cell.key,o.value->>'value'`,[v.id,q.key,JSON.stringify(q.options)])).rows;
     const matrix=q.rows!.map(row=>({label:row.label,counts:q.options.map(o=>({label:o.label,count:values.find(x=>x.row_key===row.value&&x.option_key===o.value)?.count||0}))}));
     if(minimum&&matrix.some(row=>row.counts.some(x=>x.count>0&&x.count<minimum))){questions.push({key:q.key,type:q.type,label:q.label,suppressed:true});continue;}result.matrix=matrix;
    }else if(q.type==='ranking'){
     const ranks=(await c.query('SELECT choice.value,avg(choice.position)::float mean_rank FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id CROSS JOIN LATERAL jsonb_array_elements_text(ri.answer_json) WITH ORDINALITY choice(value,position) WHERE rs.survey_version_id=$1 AND ri.question_key=$2 GROUP BY choice.value',[v.id,q.key])).rows;
     result.ranking=q.options.map(o=>({label:o.label,meanRank:ranks.find(r=>r.value===o.value)?.mean_rank??null}));
    }else if(q.options.length&&!['matrix_single','matrix_multi','ranking'].includes(q.type)||q.type==='boolean'){
     const options=q.type==='boolean'?[{value:true,label:'Ja'},{value:false,label:'Nein'}]:q.options;
     const counts=[];
     for(const o of options){const n=(await c.query('SELECT count(*)::int n FROM response_items ri JOIN response_sessions rs ON rs.id=ri.session_id WHERE rs.survey_version_id=$1 AND ri.question_key=$2 AND (ri.answer_json=$3::jsonb OR ri.answer_json @> $4::jsonb)',[v.id,q.key,JSON.stringify(o.value),JSON.stringify([o.value])])).rows[0].n;counts.push({label:o.label,count:n,percentage:count?Math.round(n/count*1000)/10:0});}
     if(minimum&&counts.some(x=>x.count>0&&x.count<minimum)){questions.push({key:q.key,type:q.type,label:q.label,suppressed:true});continue;}result.counts=counts;
    }
    questions.push(result);
   }
   const timeline=minimum?[]:(await c.query("SELECT to_char(submitted_at AT TIME ZONE 'UTC','YYYY-MM-DD') date,count(*)::int count FROM response_sessions WHERE survey_version_id=$1 GROUP BY 1 ORDER BY 1",[v.id])).rows as {date:string;count:number}[];
   return {totalResponses:total,versionId:v.id,versionNo:v.version_no,scope:'version',questions,timeline};
  });
 }
 async shares(id:string,userId:string){await this.admin(id,userId);return (await this.db.query('SELECT r.id,r.minimum_group,r.expires_at,r.revoked_at,r.created_at FROM report_shares r JOIN survey_versions v ON v.id=r.survey_version_id WHERE v.survey_id=$1 ORDER BY r.created_at DESC',[id])).rows;}
 async share(id:string,userId:string,body:unknown){const survey=await this.admin(id,userId),data=input.object(body);const min=data.minimumGroup??5;if(!Number.isInteger(min)||Number(min)<5||Number(min)>100)throw new BadRequestException('Mindestgruppe: 5 bis 100.');const days=data.days??7;if(!Number.isInteger(days)||Number(days)<1||Number(days)>90)throw new BadRequestException('Gültigkeit: 1 bis 90 Tage.');const snapshot=await this.aggregate(id,typeof data.versionId==='string'?data.versionId:undefined,Number(min));if(!snapshot.versionId)throw new BadRequestException('Für diese Version liegen nicht genügend Antworten vor.');const token=randomBytes(32).toString('base64url');const r=await this.db.query(`INSERT INTO report_shares(survey_version_id,organization_id,token_hash,minimum_group,expires_at,snapshot) VALUES($1,$2,$3,$4,now()+$5::int*interval '1 day',$6::jsonb) RETURNING id,expires_at`,[snapshot.versionId,survey.organization_id,hash(token),min,days,JSON.stringify(snapshot)]);return {...r.rows[0],token,url:`${process.env.PUBLIC_WEB_ORIGIN||'http://localhost:5173'}/r/${token}`};}
 async revoke(id:string,userId:string,shareId:string){await this.admin(id,userId);await this.db.query('UPDATE report_shares r SET revoked_at=now() FROM survey_versions v WHERE r.survey_version_id=v.id AND v.survey_id=$1 AND r.id=$2',[id,input.uuid(shareId)]);return {ok:true};}
 async publicReport(token:string){if(!/^[-\w]{43}$/.test(token))throw new NotFoundException();const r=await this.db.query('SELECT snapshot FROM report_shares WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',[hash(token)]);if(!r.rowCount)throw new NotFoundException('Ergebnisfreigabe abgelaufen oder widerrufen.');return r.rows[0].snapshot;}
 async purge(id:string,userId:string,body:unknown){const survey=await this.admin(id,userId);if(input.object(body).confirmation!==survey.title)throw new BadRequestException('Zur Bestätigung den exakten Umfragetitel eingeben.');const jobs=await this.db.transaction(async c=>{await c.query('SELECT id FROM surveys WHERE id=$1 FOR UPDATE',[id]);await c.query('DELETE FROM response_sessions WHERE survey_version_id IN (SELECT id FROM survey_versions WHERE survey_id=$1)',[id]);await c.query('DELETE FROM report_shares WHERE survey_version_id IN (SELECT id FROM survey_versions WHERE survey_id=$1)',[id]);const jobs=await c.query("UPDATE export_jobs SET status='failed',error_code='DATA_DELETED' WHERE survey_id=$1 RETURNING id,format,file_path",[id]);await c.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) VALUES($1,$2,'responses.deleted',$3)",[survey.organization_id,userId,id]);return jobs.rows;});await this.removeExportFiles(jobs);return {ok:true};}
 async removeExportFiles(jobs:{id:string;format:string;file_path:string|null}[]){const dir=process.env.EXPORT_DIR||'/tmp/surveystudio-exports';for(const j of jobs)if(j.file_path===join(dir,`${j.id}.${j.format}`))await unlink(j.file_path!).catch(()=>{});}
 async createExport(id:string,userId:string,body:unknown){await this.admin(id,userId);const data=input.object(body),format=data.format;if(!['csv','xlsx','pdf'].includes(String(format)))throw new BadRequestException('Format: csv, xlsx oder pdf.');const version=(await this.db.query('SELECT id FROM survey_versions WHERE survey_id=$1'+(data.versionId?' AND id=$2':'')+' ORDER BY version_no DESC LIMIT 1',data.versionId?[id,input.uuid(data.versionId)]:[id])).rows[0];if(!version)throw new BadRequestException('Keine veröffentlichte Version.');const job=(await this.db.query('INSERT INTO export_jobs(survey_id,requested_by,format,survey_version_id) VALUES($1,$2,$3,$4) RETURNING id,status',[id,userId,format,version.id])).rows[0];setTimeout(()=>void this.generateExport(job.id).catch(()=>{}),0);return job;}
 async exportStatus(jobId:string,userId:string){const job=(await this.db.query('SELECT * FROM export_jobs WHERE id=$1',[input.uuid(jobId)])).rows[0];if(!job)throw new NotFoundException();await this.admin(job.survey_id,userId);if(+new Date(job.expires_at)<Date.now())throw new NotFoundException('Export abgelaufen.');return job;}
 async generateExport(jobId:string){
  const job=(await this.db.query("UPDATE export_jobs SET status='running' WHERE id=$1 AND status='queued' RETURNING *",[jobId])).rows[0];if(!job)return;
  try{
   await this.admin(job.survey_id,job.requested_by);
   const dir=process.env.EXPORT_DIR||'/tmp/surveystudio-exports';await mkdir(dir,{recursive:true,mode:0o700});const file=join(dir,`${job.id}.${job.format}`);
   const version=(await this.db.query('SELECT id,document FROM survey_versions WHERE survey_id=$1 AND id=$2',[job.survey_id,job.survey_version_id])).rows[0];if(!version)throw new Error('NO_PUBLISHED_VERSION');
   const draft=version.document as SurveyDraft;
   const output=createWriteStream(file,{mode:0o600});const done=once(output,'finish');void done.catch(()=>{});
   if(job.format==='pdf'){
    const results=await this.aggregate(job.survey_id,version.id);const pdf=new PDFDocument({margin:40,bufferPages:true});pdf.on('error',(error:Error)=>output.destroy(error));pdf.pipe(output);
    pdf.font(join(__dirname,/[\u3000-\u9fff]/.test(JSON.stringify(draft))?'../../../assets/NotoSansCJKsc-Regular.otf':'../../../assets/DejaVuSans.ttf'));pdf.fontSize(20).text(draft.metadata.title);pdf.fontSize(11).text(`Version: ${results.versionNo} · Antworten: ${results.totalResponses}`);
    for(const q of results.questions){if(pdf.y>650)pdf.addPage();pdf.moveDown().fontSize(13).text(String(q.label));pdf.fontSize(10).text(`Antworten: ${q.answered}`);if(Array.isArray(q.counts))for(const c of q.counts)pdf.text(`${c.label}: ${c.count} (${c.percentage} %)`);if(q.mean!==undefined)pdf.text(`Mittelwert: ${q.mean??'–'} · Median: ${q.median??'–'}`);}
    pdf.end();
   }else{
    const columns=['Abgabe-ID','Version-ID','Abgabe UTC',...draft.questions.map(q=>q.label)];
    const workbook=job.format==='xlsx'?new ExcelJS.stream.xlsx.WorkbookWriter({stream:output,useStyles:false,useSharedStrings:false}):null;
    if(workbook){const archive=workbook as unknown as {zip:NodeJS.EventEmitter;promise:Promise<unknown>};archive.zip.on('error',(error:Error)=>output.destroy(error));void archive.promise.catch((error:Error)=>output.destroy(error));}
    const sheet=workbook?.addWorksheet('Antworten');if(sheet)sheet.addRow(columns).commit();else output.write('\ufeff'+columns.map(csvCell).join(';')+'\r\n');
    let cursor='00000000-0000-0000-0000-000000000000';
    while(true){
     const rows=(await this.db.query(`SELECT rs.id,rs.submitted_at,COALESCE((SELECT jsonb_object_agg(ri.question_key,ri.answer_json) FROM response_items ri WHERE ri.session_id=rs.id),'{}'::jsonb) answers FROM response_sessions rs WHERE rs.survey_version_id=$1 AND rs.id>$2 AND rs.submitted_at<=$3 ORDER BY rs.id LIMIT 500`,[version.id,cursor,job.created_at])).rows;if(!rows.length)break;
     for(const row of rows){const values=[row.id,version.id,new Date(row.submitted_at).toISOString(),...draft.questions.map(q=>row.answers[q.key])];if(sheet)sheet.addRow(values.map(v=>v&&typeof v==='object'?JSON.stringify(v):v)).commit();else if(!output.write(values.map(csvCell).join(';')+'\r\n'))await once(output,'drain');}cursor=rows[rows.length-1].id;
    }
    if(workbook)await workbook.commit();else output.end();
   }
   await done;const completed=await this.db.query("UPDATE export_jobs SET status='done',file_path=$1 WHERE id=$2 AND status='running'",[file,jobId]);if(!completed.rowCount)await unlink(file).catch(()=>{});
  }catch{await this.db.query("UPDATE export_jobs SET status='failed',error_code='EXPORT_FAILED' WHERE id=$1",[jobId]);}
 }
}
@Controller('surveys')
export class FeatureController {
 constructor(private readonly features:FeatureService){}
 @Patch(':id') metadata(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.metadata(id,u.id,b);}
 @Post(':id/duplicate') duplicate(@Param('id') id:string,@CurrentUser() u:Viewer){return this.features.duplicate(id,u.id);}
 @Get(':id/versions') versions(@Param('id') id:string,@CurrentUser() u:Viewer){return this.features.versions(id,u.id);}
 @Patch(':id/publication') publication(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.publication(id,u.id,b);}
 @Get(':id/history') history(@Param('id') id:string,@CurrentUser() u:Viewer){return this.features.history(id,u.id);}
 @Post(':id/history/restore') restore(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:{revision:number;expectedRevision:number}){return this.features.restore(id,u.id,b?.revision,b?.expectedRevision);}
 @Get(':id/comments') comments(@Param('id') id:string,@CurrentUser() u:Viewer){return this.features.comments(id,u.id);}
 @Post(':id/comments') comment(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.comment(id,u.id,b);}
 @Post(':id/comments/:commentId/resolve') resolve(@Param('id') id:string,@Param('commentId') c:string,@CurrentUser() u:Viewer){return this.features.resolveComment(id,u.id,c);}
 @Get(':id/report') report(@Param('id') id:string,@CurrentUser() u:Viewer,@Query('versionId') v?:string){return this.features.results(id,u.id,v);}
 @Get(':id/report-shares') shares(@Param('id') id:string,@CurrentUser() u:Viewer){return this.features.shares(id,u.id);}
 @Post(':id/report-shares') share(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.share(id,u.id,b);}
 @Delete(':id/report-shares/:shareId') revoke(@Param('id') id:string,@Param('shareId') s:string,@CurrentUser() u:Viewer){return this.features.revoke(id,u.id,s);}
 @Delete(':id/responses') purge(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.purge(id,u.id,b);}
 @Post(':id/exports') export(@Param('id') id:string,@CurrentUser() u:Viewer,@Body() b:unknown){return this.features.createExport(id,u.id,b);}
}
@Controller()
export class DeliveryController {
 constructor(private readonly features:FeatureService){}
 @Public() @Get('public/reports/:token') report(@Param('token') t:string){return this.features.publicReport(t);}
 @Get('exports/:jobId') async status(@Param('jobId') id:string,@CurrentUser() u:Viewer){const j=await this.features.exportStatus(id,u.id);return {id:j.id,status:j.status,errorCode:j.error_code};}
 @Get('exports/:jobId/download') async download(@Param('jobId') id:string,@CurrentUser() u:Viewer,@Res() res:Response){const j=await this.features.exportStatus(id,u.id);if(j.status!=='done'||!j.file_path)throw new ConflictException('Export noch nicht fertig.');await stat(j.file_path);return res.download(j.file_path,`surveystudio.${j.format}`);}
}
