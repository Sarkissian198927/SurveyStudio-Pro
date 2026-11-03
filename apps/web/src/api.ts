import { isDesktop,localStore } from './local';
export class ApiError extends Error {
 constructor(message: string, public status: number, public details: string[] = []) {super(message);}
}
let csrf = '';
export const setCsrf = (token: string) => {csrf=token;};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
 const method=(options.method||'GET').toUpperCase();
 if(isDesktop()){try{return await (await localStore()).request(path,method,typeof options.body==='string'?JSON.parse(options.body):{}) as T;}catch(e){throw new ApiError(e instanceof Error?e.message:'Lokaler Zugriff fehlgeschlagen.',409);}}
 const response=await fetch(`/api/v1${path}`,{
   ...options, credentials:'include',
   headers:{'Content-Type':'application/json',...(csrf && !['GET','HEAD'].includes(method)?{'X-Survey-CSRF':csrf}:{}),...options.headers}
 });
 if(!response.ok) {
   const body=await response.json().catch(()=>({message:'Ein unerwarteter Fehler ist aufgetreten.'}));
   const payload=body.error ?? body;
   const errors=Array.isArray(payload.details)?payload.details:Array.isArray(payload.errors)?payload.errors:[];
   throw new ApiError(Array.isArray(payload.message)?payload.message.join(' | '):(payload.message||'Verbindung fehlgeschlagen.'),response.status,errors);
 }
 return response.json() as Promise<T>;
}
export type { AppUser, Session, Project } from '@surveystudio/contracts';
export type SurveyItem = {id:string;title:string;state:string;updated_at:string;revision:number;response_count:number};
export type Publication = {slug:string;state:string;created_at:string};
