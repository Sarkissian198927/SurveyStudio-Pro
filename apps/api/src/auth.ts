import { Body, CanActivate, ConflictException, Controller, createParamDecorator, ExecutionContext, ForbiddenException, Get, Injectable, Post, Res, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Database } from './database';
import * as input from './input';

export { PUBLIC,Public,CurrentUser } from './session';
export type { Viewer } from './session';
import { PUBLIC,Public,CurrentUser,Viewer } from './session';
import { IdentityService } from './identity';
type SessionClaims={sub:string;csrf:string;sid:string};
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: Database, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<Request & {viewer:Viewer}>();
    const token: unknown = req.cookies?.survey_session;
    if (typeof token !== 'string') throw new UnauthorizedException('Bitte anmelden.');
    let session: SessionClaims;
    try {
      session = await this.jwt.verifyAsync<SessionClaims>(token, {algorithms:['HS256']});
      input.uuid(session.sub); input.uuid(session.sid);
      if (typeof session.csrf !== 'string' || !session.csrf) throw new Error('Invalid session');
    } catch { throw new UnauthorizedException('Anmeldung abgelaufen.'); }
    const user = await this.db.query(`SELECT u.id,u.verified_at FROM users u JOIN auth_sessions s ON s.user_id=u.id
      WHERE u.id=$1 AND u.status='active' AND s.id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()`, [session.sub, session.sid]);
    if (!user.rowCount) throw new UnauthorizedException('Sitzung nicht verfügbar. Bitte erneut anmelden.');
    if(process.env.NODE_ENV==='production'&&!user.rows[0].verified_at&&!req.path.startsWith('/api/v1/auth/'))throw new ForbiddenException('Bitte zuerst die E-Mail-Adresse bestätigen.');
    if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers['x-survey-csrf'] !== session.csrf)
      throw new ForbiddenException('CSRF-Schutz: Sitzung erneut laden.');
    req.viewer = {id:session.sub, csrf:session.csrf, sessionId:session.sid};
    return true;
  }
}
@Injectable()
export class AuthService {
  constructor(private readonly db:Database, private readonly jwt:JwtService,private readonly identity:IdentityService) {}
  private async createSession(userId:string, response:Response) {
    const csrf = randomBytes(24).toString('hex'), sid = randomUUID();
    const token = await this.jwt.signAsync({sub:userId, csrf, sid}, {expiresIn:'8h', algorithm:'HS256'});
    await this.db.query("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [sid,userId]);
    response.cookie('survey_session', token, {
      httpOnly:true, sameSite:'lax', secure:process.env.COOKIE_SECURE==='true', maxAge:8*60*60*1000, path:'/api/v1'
    });
    return csrf;
  }
  async register(body:unknown, response:Response) {
    const data=input.object(body), email=input.email(data.email), displayName=input.text(data.displayName,'Name',120), password=input.password(data.password);
    const hashed=await bcrypt.hash(password,12);
    let userId:string;
    try {
      userId=await this.db.transaction(async client=>{
        const u=await client.query<{id:string}>('INSERT INTO users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,displayName,hashed]);
        const org=await client.query<{id:string}>('INSERT INTO organizations(name) VALUES($1) RETURNING id',[`${displayName} – Arbeitsbereich`]);
        const project=await client.query<{id:string}>('INSERT INTO projects(organization_id,title) VALUES($1,$2) RETURNING id',[org.rows[0].id,'Mein erstes Projekt']);
        await client.query('INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$3)',[org.rows[0].id,u.rows[0].id,'owner']);
        await client.query('INSERT INTO project_members(project_id,user_id,role,organization_id) VALUES($1,$2,$3,$4)',[project.rows[0].id,u.rows[0].id,'owner',org.rows[0].id]);
        await this.identity.issue(client,u.rows[0].id,email,'verify');
        return u.rows[0].id;
      });
    } catch(error:unknown) {
      if (error && typeof error==='object' && 'code' in error && error.code==='23505') throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
      throw error;
    }
    return {user:{id:userId,email,displayName},csrfToken:await this.createSession(userId,response)};
  }
  async login(body:unknown,response:Response) {
    const data=input.object(body), email=input.email(data.email);
    if (typeof data.password !== 'string' || Buffer.byteLength(data.password)>72) throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    const user=await this.db.query<{id:string;email:string;display_name:string;password_hash:string}>('SELECT id,email,display_name,password_hash FROM users WHERE lower(email)=$1 AND status=$2',[email,'active']);
    // Perform a password hash check for unknown accounts as well.
    const hash=user.rows[0]?.password_hash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid=await bcrypt.compare(data.password,hash);
    if (!valid || !user.rowCount) throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    const u=user.rows[0];
    return {user:{id:u.id,email:u.email,displayName:u.display_name},csrfToken:await this.createSession(u.id,response)};
  }
  async me(viewer:Viewer) {
    const {rows}=await this.db.query<{id:string;email:string;display_name:string;verified_at:Date|null}>('SELECT id,email,display_name,verified_at FROM users WHERE id=$1',[viewer.id]);
    return {user:{id:rows[0].id,email:rows[0].email,displayName:rows[0].display_name,emailVerified:!!rows[0].verified_at},csrfToken:viewer.csrf};
  }
  async logout(viewer:Viewer,response:Response) {
    await this.db.query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2',[viewer.sessionId,viewer.id]);
    response.clearCookie('survey_session',{path:'/api/v1',httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true'});
    return {ok:true};
  }
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth:AuthService) {}
  @Public() @Post('register') register(@Body() body:unknown,@Res({passthrough:true}) res:Response) {return this.auth.register(body,res);}
  @Public() @Post('login') login(@Body() body:unknown,@Res({passthrough:true}) res:Response) {return this.auth.login(body,res);}
  @Get('me') me(@CurrentUser() viewer:Viewer) {return this.auth.me(viewer);}
  @Post('logout') logout(@CurrentUser() viewer:Viewer,@Res({passthrough:true}) res:Response) {return this.auth.logout(viewer,res);}
}
