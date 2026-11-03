import { Body, Controller, ForbiddenException, Get, Injectable, Param, Post } from '@nestjs/common';
import { CurrentUser, Viewer } from './auth';
import { Database } from './database';
import * as input from './input';

@Injectable()
export class OrganizationService {
  constructor(private readonly db:Database) {}
  async list(userId:string) {
    return (await this.db.query(`SELECT o.id,o.name,om.role FROM organizations o JOIN organization_members om
      ON om.organization_id=o.id WHERE om.user_id=$1 ORDER BY o.created_at,o.id`,[userId])).rows;
  }
  async create(userId:string,body:unknown) {
    const name=input.text(input.object(body).name,'Arbeitsbereich');
    return this.db.transaction(async client=>{
      const org=await client.query('INSERT INTO organizations(name) VALUES($1) RETURNING id,name',[name]);
      await client.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",[org.rows[0].id,userId]);
      return {...org.rows[0],role:'owner'};
    });
  }
  async members(orgId:string,userId:string) {
    const allowed=await this.db.query("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('owner','admin')",[input.uuid(orgId),userId]);
    if (!allowed.rowCount) throw new ForbiddenException('Keine Verwaltungsrechte im Arbeitsbereich.');
    return (await this.db.query(`SELECT u.id,u.email,u.display_name,om.role FROM organization_members om
      JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 ORDER BY u.display_name,u.id`,[orgId])).rows;
  }
  async addMember(orgId:string,userId:string,body:unknown) {
    const email=input.email(input.object(body).email);
    return this.db.transaction(async client=>{
      const allowed=await client.query("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('owner','admin') FOR SHARE",[input.uuid(orgId),userId]);
      if (!allowed.rowCount) throw new ForbiddenException('Keine Verwaltungsrechte im Arbeitsbereich.');
      // Neutral outcome avoids disclosing whether an unrelated account exists.
      await client.query(`INSERT INTO organization_members(organization_id,user_id,role)
        SELECT $1,id,'member' FROM users WHERE lower(email)=$2 AND status='active' ON CONFLICT DO NOTHING`,[orgId,email]);
      await client.query("INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) VALUES($1,$2,'organization.member.added',$1)",[orgId,userId]);
      return {message:'Falls das Konto existiert, wurde es dem Arbeitsbereich hinzugefügt.'};
    });
  }
}
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizations:OrganizationService) {}
  @Get() list(@CurrentUser() viewer:Viewer) {return this.organizations.list(viewer.id);}
  @Post() create(@CurrentUser() viewer:Viewer,@Body() body:unknown) {return this.organizations.create(viewer.id,body);}
  @Get(':id/members') members(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.organizations.members(id,viewer.id);}
  @Post(':id/members') addMember(@CurrentUser() viewer:Viewer,@Param('id') id:string,@Body() body:unknown) {return this.organizations.addMember(id,viewer.id,body);}
}
