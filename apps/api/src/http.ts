import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
export function requestContext(_req:Request,res:Response,next:NextFunction) {
  res.setHeader('X-Request-ID',randomUUID());
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  next();
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception:unknown,host:ArgumentsHost) {
    const response=host.switchToHttp().getResponse<Response>();
    const status=exception instanceof HttpException?exception.getStatus():500;
    const raw=exception instanceof HttpException?exception.getResponse():null;
    const body=typeof raw==='object' && raw!==null?raw as Record<string,unknown>:{};
    const message=status>=500?'Ein interner Fehler ist aufgetreten.':body.message??raw??'Anfrage fehlgeschlagen.';
    const codes:Record<number,string>={400:'INVALID_REQUEST',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',410:'GONE',422:'VALIDATION_FAILED',429:'RATE_LIMITED'};
    const details=Array.isArray(body.errors)?body.errors:[];
    response.status(status).json({error:{code:codes[status]??'INTERNAL_ERROR',message,details},requestId:response.getHeader('X-Request-ID')});
  }
}
