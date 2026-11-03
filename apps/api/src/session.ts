import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
export const PUBLIC='survey_public_endpoint';
export const Public=()=>SetMetadata(PUBLIC,true);
export type Viewer={id:string;csrf:string;sessionId:string};
export const CurrentUser=createParamDecorator((_data:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest<Request&{viewer:Viewer}>().viewer);
