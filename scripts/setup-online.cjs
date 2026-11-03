'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto');
function configuration(domain,email){
 if(typeof domain!=='string'||domain.length>253||!domain.includes('.')||domain.includes('..')||domain.split('.').some(part=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))||domain==='localhost'||/^\d+(?:\.\d+){3}$/.test(domain))throw Error('Eine öffentliche Domain ohne https://, Pfad oder Port angeben.');
 if(typeof email!=='string'||email.length>320||!/^[^\s@=]+@[^\s@=]+\.[^\s@=]+$/.test(email))throw Error('Gültige Administrator-E-Mail-Adresse angeben.');
 return {SURVEY_DOMAIN:domain.toLowerCase(),ADMIN_EMAIL:email.toLowerCase(),ADMIN_PASSWORD:randomBytes(24).toString('hex'),POSTGRES_PASSWORD:randomBytes(32).toString('hex'),JWT_SECRET:randomBytes(48).toString('hex'),DATA_ENCRYPTION_KEY:randomBytes(48).toString('hex')};
}
if(require.main===module){const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1],domain=args.includes('--domain')?get('--domain'):null,email=args.includes('--email')?get('--email'):null;const target=path.resolve('.env.server');const config=configuration(domain,email);fs.writeFileSync(target,Object.entries(config).map(([key,value])=>`${key}=${/[#$'\\]/.test(value)?"'"+value.replaceAll("'","\\'")+"'":value}`).join('\n')+'\n',{mode:0o600,flag:'wx'});console.log('Geschützte .env.server angelegt. Sie enthält das erste Administratorpasswort. Datei nicht veröffentlichen. Bestehende Konfigurationen werden nicht überschrieben.');}
module.exports={configuration};
