import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Injectable, Param, Patch, Post } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CurrentUser, Viewer } from './auth';
import { Database } from './database';
import { isProjectRole, permits, ProjectAction } from './permissions';
import * as input from './input';

@Injectable()
export class ProjectService {
  constructor(private readonly db:Database) {}
  async list(userId:string) {
    return (await this.db.query(`SELECT p.id,p.organization_id,p.title,p.parent_project_id,pm.role,p.created_at FROM projects p
      JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 ORDER BY p.created_at,p.id`,[userId])).rows;
  }
  async role(projectId:string,userId:string,needWrite=false) {
    return this.authorize(projectId,userId,needWrite?'write':'read');
  }
  async authorize(projectId:string,userId:string,action:ProjectAction,client?:PoolClient) {
    input.uuid(projectId);
    const sql='SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2';
    const result=client?await client.query<{role:string}>(sql,[projectId,userId]):await this.db.query<{role:string}>(sql,[projectId,userId]);
    if (!permits(result.rows[0]?.role,action)) throw new ForbiddenException('Keine Berechtigung für dieses Projekt.');
    return result.rows[0].role;
  }
  async get(projectId:string,userId:string) {
    await this.authorize(projectId,userId,'read');
    return (await this.db.query('SELECT id,organization_id,title,parent_project_id,created_at FROM projects WHERE id=$1',[projectId])).rows[0];
  }
  async auditList(projectId:string,userId:string){await this.authorize(projectId,userId,'manage');return (await this.db.query('SELECT id,action,resource_id,created_at FROM audit_events WHERE resource_id=$1 OR resource_id IN(SELECT id FROM surveys WHERE project_id=$1) ORDER BY created_at DESC LIMIT 200',[projectId])).rows;}
  async create(userId:string,body:unknown) {
    const data=input.object(body), title=input.text(data.title,'Projektname'), organizationId=input.uuid(data.organizationId);
    return this.db.transaction(async client=>{
      // Lock the membership for the authorization and write to share one transaction.
      const org=await client.query("SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('owner','admin') FOR SHARE",[organizationId,userId]);
      if (!org.rowCount) throw new ForbiddenException('Keine Berechtigung zur Projekterstellung.');
      const parent=data.parentProjectId?input.uuid(data.parentProjectId):null;if(parent){await this.authorize(parent,userId,'write',client);const p=await client.query('SELECT 1 FROM projects WHERE id=$1 AND organization_id=$2',[parent,organizationId]);if(!p.rowCount)throw new ForbiddenException('Projektordner gehört zu einem anderen Arbeitsbereich.');}
      const result=await client.query('INSERT INTO projects(organization_id,title,parent_project_id) VALUES($1,$2,$3) RETURNING id,organization_id,title,parent_project_id,created_at',[organizationId,title,parent]);
      await client.query("INSERT INTO project_members(project_id,user_id,role,organization_id) VALUES($1,$2,'owner',$3)",[result.rows[0].id,userId,organizationId]);
      await this.audit(client,organizationId,userId,'project.created',result.rows[0].id);
      return {...result.rows[0],role:'owner'};
    });
  }
  async rename(projectId:string,userId:string,body:unknown) {
    const title=input.text(input.object(body).title,'Projektname');
    return this.db.transaction(async client=>{
      await client.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[input.uuid(projectId)]);
      await this.authorize(projectId,userId,'write',client);
      return (await client.query('UPDATE projects SET title=$1 WHERE id=$2 RETURNING id,organization_id,title,created_at',[title,projectId])).rows[0];
    });
  }
  async members(projectId:string,userId:string) {
    // Member emails are management data, not exposed to viewers/editors.
    await this.authorize(projectId,userId,'manage');
    return (await this.db.query(`SELECT u.id,u.display_name,u.email,pm.role FROM project_members pm
      JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY u.display_name,u.id`,[projectId])).rows;
  }
  async setMember(projectId:string,userId:string,body:unknown) {
    const data=input.object(body), email=input.email(data.email), role=data.role;
    if (!isProjectRole(role)) throw new BadRequestException('Ungültige Projektrolle.');
    return this.db.transaction(async client=>{
      const p=await client.query('SELECT organization_id FROM projects WHERE id=$1 FOR UPDATE',[input.uuid(projectId)]);
      await this.authorize(projectId,userId,'manage',client);
      const orgId:string=p.rows[0].organization_id;
      const target=await client.query<{id:string}>(`SELECT u.id FROM users u JOIN organization_members om ON om.user_id=u.id
        WHERE om.organization_id=$1 AND lower(u.email)=$2 AND u.status='active'`,[orgId,email]);
      if (!target.rowCount) throw new BadRequestException('Person muss zuerst Mitglied des Arbeitsbereichs sein.');
      const targetId=target.rows[0].id;
      await this.keepOwner(client,projectId,targetId,role);
      await client.query(`INSERT INTO project_members(project_id,user_id,role,organization_id) VALUES($1,$2,$3,$4)
        ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role`,[projectId,targetId,role,orgId]);
      await this.audit(client,orgId,userId,'project.member.changed',projectId);
      return {id:targetId,role};
    });
  }
  async removeMember(projectId:string,userId:string,targetId:string) {
    input.uuid(targetId);
    return this.db.transaction(async client=>{
      const p=await client.query('SELECT organization_id FROM projects WHERE id=$1 FOR UPDATE',[input.uuid(projectId)]);
      await this.authorize(projectId,userId,'manage',client);
      await this.keepOwner(client,projectId,targetId,null);
      await client.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',[projectId,targetId]);
      await this.audit(client,p.rows[0].organization_id,userId,'project.member.removed',projectId);
      return {ok:true};
    });
  }
  private async keepOwner(client:PoolClient,projectId:string,targetId:string,newRole:string|null) {
    if (newRole==='owner') return;
    const current=await client.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2',[projectId,targetId]);
    if (current.rows[0]?.role!=='owner') return;
    const others=await client.query("SELECT 1 FROM project_members WHERE project_id=$1 AND user_id<>$2 AND role='owner'",[projectId,targetId]);
    if (!others.rowCount) throw new ConflictException('Mindestens ein Owner muss erhalten bleiben.');
  }
  private async audit(client:PoolClient,orgId:string,userId:string,action:string,id:string) {
    await client.query('INSERT INTO audit_events(organization_id,actor_user_id,action,resource_id) VALUES($1,$2,$3,$4)',[orgId,userId,action,id]);
  }
}
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects:ProjectService) {}
  @Get() list(@CurrentUser() viewer:Viewer) {return this.projects.list(viewer.id);}
  @Post() create(@CurrentUser() viewer:Viewer,@Body() data:unknown) {return this.projects.create(viewer.id,data);}
  @Get(':id') get(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.projects.get(id,viewer.id);}
  @Patch(':id') rename(@CurrentUser() viewer:Viewer,@Param('id') id:string,@Body() data:unknown) {return this.projects.rename(id,viewer.id,data);}
  @Get(':id/audit') audit(@CurrentUser() viewer:Viewer,@Param('id') id:string){return this.projects.auditList(id,viewer.id);}
  @Get(':id/members') members(@CurrentUser() viewer:Viewer,@Param('id') id:string) {return this.projects.members(id,viewer.id);}
  @Post(':id/members') setMember(@CurrentUser() viewer:Viewer,@Param('id') id:string,@Body() data:unknown) {return this.projects.setMember(id,viewer.id,data);}
  @Delete(':id/members/:userId') removeMember(@CurrentUser() viewer:Viewer,@Param('id') id:string,@Param('userId') userId:string) {return this.projects.removeMember(id,viewer.id,userId);}
}
