import sharp from 'sharp';
import { BadRequestException,Body,Controller,Delete,ForbiddenException,Get,Injectable,NotFoundException,Param,Post,Req,Res } from '@nestjs/common';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Request,Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Database } from './database';
import { ProjectService } from './projects';
import { CurrentUser,Public,Viewer } from './session';
import * as input from './input';
@Injectable()
export class AssetService {
 constructor(private readonly db:Database,private readonly projects:ProjectService,private readonly jwt:JwtService){}
 private directory(){return process.env.ASSET_DIR||'/workspace/.surveystudio-assets';}
 async upload(userId:string,body:unknown){
  const data=input.object(body),project=input.uuid(data.projectId);await this.projects.role(project,userId,true);
  if(typeof data.data!=='string'||data.data.length>2_000_000)throw new BadRequestException('Bild zu groß.');
  const match=data.data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new BadRequestException('Nur PNG, JPG oder WebP.');
  let bytes:Buffer=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>1_400_000)throw new BadRequestException('Bild maximal 1,4 MB.');
  const declared=match[1];let mime=declared;const valid=declared==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)throw new BadRequestException('Bildinhalt passt nicht zum Dateityp.');
  try{bytes=await sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning'}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();mime='image/webp';}catch{throw new BadRequestException('Bild ist beschädigt oder überschreitet das Pixellimit.');}
  if(bytes.length>1_400_000)throw new BadRequestException('Verarbeitetes Bild zu groß.');
  const sha=createHash('sha256').update(bytes).digest('hex'),existing=await this.db.query('SELECT id FROM assets WHERE project_id=$1 AND sha256=$2',[project,sha]);if(existing.rowCount)return {url:`/api/v1/public/assets/${existing.rows[0].id}`};
  const id=randomUUID();await mkdir(this.directory(),{recursive:true,mode:0o700});await writeFile(join(this.directory(),id),bytes,{mode:0o600,flag:'wx'});
  try{await this.db.query('INSERT INTO assets(id,project_id,mime_type,bytes,sha256) VALUES($1,$2,$3,$4,$5)',[id,project,mime,bytes.length,sha]);}catch(error){await unlink(join(this.directory(),id)).catch(()=>{});throw error;}return {url:`/api/v1/public/assets/${id}`};
 }
 async read(id:string,req:Request){
  const asset=(await this.db.query('SELECT * FROM assets WHERE id=$1',[input.uuid(id)])).rows[0];if(!asset)throw new NotFoundException();
  let permitted=false;
  try{const claims=await this.jwt.verifyAsync<{sub:string;sid:string}>(req.cookies?.survey_session,{algorithms:['HS256']});const s=await this.db.query("SELECT 1 FROM auth_sessions a JOIN users u ON u.id=a.user_id WHERE a.id=$1 AND a.user_id=$2 AND a.revoked_at IS NULL AND a.expires_at>now() AND u.status='active'",[claims.sid,claims.sub]);if(s.rowCount){await this.projects.role(asset.project_id,claims.sub);permitted=true;}}catch{}
  if(!permitted){const url=`/api/v1/public/assets/${id}`;const p=await this.db.query(`SELECT 1 FROM survey_versions v JOIN surveys s ON s.id=v.survey_id JOIN publications p ON p.survey_version_id=v.id WHERE s.project_id=$1 AND p.state='active' AND (p.opens_at IS NULL OR p.opens_at<=now()) AND (p.closes_at IS NULL OR p.closes_at>now()) AND (v.document#>>'{theme,backgroundImage}'=$2 OR v.document#>>'{theme,logoImage}'=$2) LIMIT 1`,[asset.project_id,url]);permitted=!!p.rowCount;}
  if(!permitted)throw new NotFoundException();return {...asset,file:join(this.directory(),id)};
 }
 async delete(id:string,userId:string){const a=(await this.db.query('SELECT project_id FROM assets WHERE id=$1',[input.uuid(id)])).rows[0];if(!a)throw new NotFoundException();if(await this.projects.role(a.project_id,userId)!=='owner')throw new ForbiddenException();const url=`/api/v1/public/assets/${id}`;const used=await this.db.query('SELECT 1 FROM survey_versions WHERE document::text LIKE $1 UNION ALL SELECT 1 FROM survey_drafts WHERE document::text LIKE $1 LIMIT 1',['%'+url+'%']);if(used.rowCount)throw new BadRequestException('Bild wird in einem Entwurf oder veröffentlichten Snapshot verwendet.');await this.db.query('DELETE FROM assets WHERE id=$1',[id]);await unlink(join(this.directory(),id)).catch(()=>{});return {ok:true};}
}
@Controller()
export class AssetController {
 constructor(private readonly assets:AssetService){}
 @Post('assets') upload(@CurrentUser() u:Viewer,@Body() b:unknown){return this.assets.upload(u.id,b);}
 @Delete('assets/:id') delete(@CurrentUser() u:Viewer,@Param('id') id:string){return this.assets.delete(id,u.id);}
 @Public() @Get('public/assets/:id') async image(@Param('id') id:string,@Req() req:Request,@Res() res:Response){const a=await this.assets.read(id,req);res.setHeader('Content-Type',a.mime_type);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");return res.sendFile(a.file,{dotfiles:'allow'});}
}
