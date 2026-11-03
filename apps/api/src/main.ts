import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({path:resolve(__dirname,'../../../.env')});
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json,static as staticFiles } from 'express';
import { ApiExceptionFilter, requestContext } from './http';
async function bootstrap() {
  if(!process.env.DATABASE_URL&&!process.env.PGHOST) throw new Error('DATABASE_URL fehlt in .env');
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32 || process.env.JWT_SECRET.startsWith('replace-with-')) throw new Error('JWT_SECRET muss mindestens 32 Zeichen enthalten');
  if(process.env.NODE_ENV==='production' && process.env.COOKIE_SECURE!=='true') throw new Error('In Produktion ist COOKIE_SECURE=true erforderlich.');
  if(process.env.NODE_ENV==='production'&&(!process.env.DATA_ENCRYPTION_KEY||process.env.DATA_ENCRYPTION_KEY.length<32||process.env.DATA_ENCRYPTION_KEY.startsWith('replace-with-')))throw new Error('In Produktion ist DATA_ENCRYPTION_KEY mit mindestens 32 Zeichen erforderlich.');
  const {AppModule}=await import('./app.module');
  const app=await NestFactory.create(AppModule,{bodyParser:false});
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');
  app.enableCors({origin:process.env.WEB_ORIGIN||'http://localhost:5173',credentials:true,allowedHeaders:['Content-Type','X-Survey-CSRF'],methods:['GET','POST','PATCH','DELETE','OPTIONS']});
  app.use(requestContext);
  const proxyHops=Number(process.env.TRUST_PROXY_HOPS||0);if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>2)throw new Error('TRUST_PROXY_HOPS muss 0, 1 oder 2 sein.');if(proxyHops)app.getHttpAdapter().getInstance().set('trust proxy',proxyHops);
  const attempts=new Map<string,{count:number;until:number}>();
  app.use((req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
    if(req.method==='POST'&&/^\/api\/v1\/auth\/(login|register|password-reset|verification)/.test(req.path)){
      const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
      const address=req.ip||req.socket.remoteAddress||'local';const key=require('node:crypto').createHash('sha256').update(address).digest('hex');
      const value=attempts.get(key)||{count:0,until:now+60000};value.count++;attempts.set(key,value);
      if(value.count>100){res.setHeader('Retry-After','60');res.status(429).json({error:{code:'RATE_LIMITED',message:'Zu viele Anfragen. Bitte später erneut versuchen.',details:[]},requestId:res.getHeader('X-Request-ID')});return;}
    }next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use(cookieParser());
  // Do not record participant IPs or user agents in application logs.
  app.use(json({limit:'24mb'}));
  if(process.env.SERVE_WEB==='true'){const webRoot=resolve(__dirname,'../../web/dist');app.use(staticFiles(webRoot));app.use((req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{if(req.method==='GET'&&!req.path.startsWith('/api/')&&req.accepts('html'))res.sendFile(resolve(webRoot,'index.html'));else next();});}
  await app.listen(Number(process.env.API_PORT)||3001,process.env.API_HOST||'127.0.0.1');
  console.log(`SurveyStudio API unter http://localhost:${process.env.API_PORT||3001}/api/v1`);
}
bootstrap().catch(e=>{console.error(e);process.exit(1);});
