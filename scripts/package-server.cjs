'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const target=path.resolve('artifacts/server');fs.mkdirSync(target,{recursive:true});const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('git',['archive','--format=zip','--prefix=SurveyStudio-Pro-Server/','--output='+path.join(target,'SurveyStudio-Pro-0.5.0-Server.zip'),commit]);
fs.writeFileSync(path.join(target,'server-build-manifest.json'),JSON.stringify({version:'0.5.0',commit,requiresHosting:true,https:'Caddy with operator-owned domain',productionReadiness:'See ONLINE_BEREITSTELLUNG.md; no public instance is automatically provisioned'},null,2)+'\n');console.log('Serverquellpaket ohne lokale Geheimnisdateien erstellt.');
