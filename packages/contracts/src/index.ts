import type { EntityId } from '@surveystudio/schema';
import type { ProjectRole } from '@surveystudio/logic';
export type AppUser = {id:EntityId;email:string;displayName:string};
export type Session = {user:AppUser;csrfToken:string};
export type Project = {id:EntityId;organization_id:EntityId;title:string;parent_project_id?:EntityId|null;role:ProjectRole};
export type ApiFailure = {error:{code:string;message:string;details:string[]};requestId:string};
