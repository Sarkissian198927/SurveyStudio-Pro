import { Controller, Get } from '@nestjs/common';
import { Public } from './auth';
import { Database } from './database';

type Schema = Record<string, unknown>;
const string = (maxLength=160):Schema => ({type:'string',minLength:1,maxLength});
const id:Schema={type:'string',format:'uuid'};
const object = (properties:Record<string,Schema>,required=Object.keys(properties)):Schema => ({type:'object',properties,required});
const user=object({id,email:{type:'string',format:'email'},displayName:string(120)});
const session=object({user,csrfToken:string(48)});
const project=object({id,organization_id:id,title:string(),created_at:{type:'string',format:'date-time'}});
const organization=object({id,name:string(),role:{type:'string',enum:['owner','admin','member']}});
const member=object({id,display_name:string(120),email:{type:'string',format:'email'},role:{type:'string',enum:['owner','editor','viewer','analyst','guest']}});
const array=(items:Schema):Schema=>({type:'array',items});
const error=object({error:object({code:string(),message:{type:'string'},details:array({type:'string'})}),requestId:{type:'string',format:'uuid'}});
const json=(schema:Schema)=>({'application/json':{schema}});
function operation(summary:string,status:number,response:Schema,body?:Schema,parameters:unknown[]=[],isPublic=false) {
  const responses:Record<string,unknown>={[status]:{description:'Erfolgreich',content:json(response)}};
  for (const code of [400,401,403,409,500]) responses[code]={description:'Fehler',content:json(error)};
  return {summary,security:isPublic?[]:[{sessionCookie:[]}],parameters:[...parameters,...(!isPublic&&body?[{in:'header',name:'X-Survey-CSRF',required:true,schema:{type:'string'},description:'Aus /auth/me, /auth/login oder /auth/register'}]:[])],
    ...(body?{requestBody:{required:true,content:json(body)}}:{}),responses};
}
const pathId=(name='id')=>({in:'path',name,required:true,schema:id});
const ok=object({ok:{type:'boolean'}});
export const openApi={
  openapi:'3.0.3',info:{title:'SurveyStudio Pro – I-01 API',version:'0.3.0',description:'Dokumentiert den geprüften Identitäts-/Projektkern. Feature-Endpunkte sind enthalten; fachliche Body-Prüfung bleibt maßgeblich.'},
  servers:[{url:'/api/v1'}],components:{securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'survey_session'}}},
  paths:{
    '/auth/register':{post:operation('Registrierung mit Arbeitsbereich und Projekt',201,session,object({displayName:string(120),email:{type:'string',format:'email',maxLength:320},password:{type:'string',minLength:12,maxLength:72,description:'Maximal 72 UTF-8-Bytes'}}),[],true)},
    '/auth/login':{post:operation('Anmelden',201,session,object({email:{type:'string',format:'email'},password:{type:'string'}}),[],true)},
    '/auth/me':{get:operation('Eigene Identität und CSRF-Token',200,session)},
    '/auth/logout':{post:{...operation('Aktuelle Sitzung serverseitig widerrufen',201,ok),parameters:[{in:'header',name:'X-Survey-CSRF',required:true,schema:{type:'string'}}]}},
    '/organizations':{get:operation('Eigene Arbeitsbereiche',200,array(organization)),post:operation('Arbeitsbereich erstellen',201,organization,object({name:string()}))},
    '/organizations/{id}/members':{get:operation('Arbeitsbereichsmitglieder (Owner/Admin)',200,array(object({id,display_name:string(120),email:{type:'string',format:'email'},role:{type:'string',enum:['owner','admin','member']}})),undefined,[pathId()]),post:operation('Bestehendes Konto als Mitglied hinzufügen (Owner/Admin)',201,object({message:{type:'string'}}),object({email:{type:'string',format:'email'}}),[pathId()])},
    '/projects':{get:operation('Eigene Projekte mit Rolle',200,array({...project,properties:{...project.properties as object,role:{type:'string',enum:['owner','editor','viewer','analyst','guest']}}})),post:operation('Projekt in explizitem Arbeitsbereich erstellen',201,project,object({title:string(),organizationId:id}))},
    '/projects/{id}':{get:operation('Projekt lesen',200,project,undefined,[pathId()]),patch:operation('Projekt umbenennen (Owner/Editor)',200,project,object({title:string()}),[pathId()])},
    '/projects/{id}/members':{get:operation('Projektmitglieder (Owner)',200,array(member),undefined,[pathId()]),post:operation('Mitglied hinzufügen oder Rolle ändern (Owner)',201,object({id,role:{type:'string',enum:['owner','editor','viewer','analyst','guest']}}),object({email:{type:'string',format:'email'},role:{type:'string',enum:['owner','editor','viewer','analyst','guest']}}),[pathId()])},
    '/projects/{id}/members/{userId}':{delete:{...operation('Mitglied entfernen (Owner; letzter Owner bleibt)',200,ok,undefined,[pathId(),pathId('userId')]),parameters:[pathId(),pathId('userId'),{in:'header',name:'X-Survey-CSRF',required:true,schema:{type:'string'}}]}},
    '/health':{get:operation('API und Datenbank verfügbar',200,object({status:{type:'string',enum:['ok']}}),undefined,[],true)},
  }
};
// The manually typed identity contracts above remain stable; all additional feature routes are included below.
const generic:Schema={type:'object',additionalProperties:true};
Object.assign(openApi.components.securitySchemes,{deviceToken:{type:'http',scheme:'bearer'}});
const extra:Record<string,Record<string,unknown>>={};
for(const [route,method,label,isPublic] of [
 ['/assets','post','Rasterbild prüfen und Metadaten entfernen',false],['/assets/{id}','delete','Unverwendetes Bild entfernen',false],['/public/assets/{id}','get','Berechtigtes oder veröffentlichtes Rasterbild',true],['/surveys/{id}/invitees/{personId}/export','get','Berechtigte personenbezogene Auskunft',false],['/surveys/{id}/invitees/{personId}','patch','Personenbezug berichtigen',false],['/surveys/{id}/invitees/{personId}/erase','post','Personenbezug und zugeordnete Antworten löschen',false],['/auth/password-reset/request','post','Reset-Nachricht vorbereiten',true],['/auth/password-reset/confirm','post','Einmaligen Reset bestätigen',true],['/auth/verification/request','post','Verifikation anfordern',false],['/auth/verification/confirm','post','Einmalige Verifikation bestätigen',true],['/auth/mail-status','get','Versandstatus',false],['/auth/development-mailbox','get','Nur Entwicklung: eigene lokale Nachrichten',false],['/auth/device-token','post','Gerätezugang erzeugen',false],['/auth/device-token','delete','Gerätezugänge widerrufen',false],
 ['/surveys/{id}','patch','Umfragemetadaten ändern',false],['/surveys/{id}/duplicate','post','Umfrage kopieren',false],['/surveys/{id}/versions','get','Veröffentlichte Versionen',false],['/surveys/{id}/publication','patch','Zeitsteuerung und Pause',false],['/surveys/{id}/history','get','Revisionen',false],['/surveys/{id}/history/restore','post','Revision als neuen Entwurf wiederherstellen',false],['/surveys/{id}/comments','get','Kommentare lesen',false],['/surveys/{id}/comments','post','Kommentar schreiben',false],['/surveys/{id}/comments/{commentId}/resolve','post','Kommentar erledigen',false],
 ['/surveys/{id}/report','get','SQL-aggregierte Versionsauswertung',false],['/surveys/{id}/report-shares','get','Ergebnisfreigaben',false],['/surveys/{id}/report-shares','post','Unveränderliche Ergebnisfreigabe erzeugen',false],['/surveys/{id}/report-shares/{shareId}','delete','Freigabe widerrufen',false],['/surveys/{id}/responses','delete','Antworten nach Titelbestätigung löschen',false],['/surveys/{id}/exports','post','Exportjob erzeugen',false],['/exports/{jobId}','get','Exportstatus',false],['/exports/{jobId}/download','get','Berechtigter Exportdownload',false],['/surveys/{id}/retention/run','post','Fällige Löschfrist anwenden',false],
 ['/surveys/{id}/invitees','get','Verschlüsselte Teilnehmerliste lesen',false],['/surveys/{id}/invitees/import','post','CSV-/XLSX-Import und Vorschau',false],['/surveys/{id}/invitees/{personId}','delete','Teilnehmer löschen und Zuordnung entkoppeln',false],['/surveys/{id}/invitations','post','Einladungsnachrichten vorbereiten',false],['/public/invites/{token}','get','Persönliche Einladung öffnen',true],['/public/reports/{token}','get','Nur freigegebenen Snapshot lesen',true],['/sync/push','post','Idempotente Geräte-Synchronisation',true],['/projects/{id}/audit','get','Projekt-Auditereignisse',false]
] as [string,string,string,boolean][]){const params=[...route.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]==='token'?{in:'path',name:'token',required:true,schema:{type:'string'}}:pathId(m[1]));const op=operation(label,method==='post'?201:200,generic,['post','patch','delete'].includes(method)?generic:undefined,params,isPublic);if(route==='/sync/push')op.security=[{deviceToken:[]}] as unknown as typeof op.security;(extra[route]??={})[method]=op;}
Object.assign(openApi.paths,extra);
@Controller()
export class InfrastructureController {
  constructor(private readonly db:Database) {}
  @Public() @Get('health') async health() {await this.db.query('SELECT 1');return {status:'ok'};}
  @Public() @Get('openapi.json') spec() {return openApi;}
}
