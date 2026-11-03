import { Body,Controller,Injectable,OnModuleDestroy,OnModuleInit,Param,Post } from '@nestjs/common';
import { Database } from './database';
import { FeatureService } from './features';
import { CurrentUser,Viewer } from './session';
@Injectable()
export class MaintenanceService implements OnModuleInit,OnModuleDestroy {
 private timer?:NodeJS.Timeout;private running=false;
 constructor(private readonly db:Database){}
 onModuleInit(){this.timer=setInterval(()=>void this.run().catch(()=>{}),3600000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async run(surveyId?:string){if(this.running)return {deleted:0};this.running=true;try{return await this.db.transaction(async c=>{
  const expired=await c.query(`DELETE FROM response_sessions r USING survey_versions v WHERE r.survey_version_id=v.id
   AND (v.document#>>'{privacy,retentionDays}') ~ '^[1-9][0-9]{0,3}$'
   AND r.submitted_at < now()-LEAST(3650,(v.document#>>'{privacy,retentionDays}')::int)*interval '1 day'
   ${surveyId?'AND v.survey_id=$1':''} RETURNING r.survey_version_id`,surveyId?[surveyId]:[]);
  const versions=[...new Set(expired.rows.map(r=>r.survey_version_id))];if(versions.length)await c.query('DELETE FROM report_shares WHERE survey_version_id=ANY($1::uuid[])',[versions]);
  return {deleted:expired.rowCount||0};
 });}finally{this.running=false;}}
}
@Controller('surveys')
export class MaintenanceController {
 constructor(private readonly maintenance:MaintenanceService,private readonly features:FeatureService){}
 @Post(':id/retention/run') async run(@Param('id') id:string,@CurrentUser() u:Viewer){await this.features.admin(id,u.id);return this.maintenance.run(id);}
}
