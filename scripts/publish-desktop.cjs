'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
assert.equal(process.env.GITHUB_ACTIONS,'true','Veröffentlichung über den Repository-Workflow ausführen.');
const repo=process.env.GITHUB_REPOSITORY,runId=process.env.BUILD_RUN_ID,commit=process.env.BUILD_COMMIT,tag=process.env.RELEASE_TAG;
assert.equal(repo,'Sarkissian198927/SurveyStudio-Pro');assert.equal(tag,'v0.4.0-preview.1');assert.match(commit,/^[a-f0-9]{40}$/);assert.match(runId,/^\d+$/);
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:5_000_000});
const run=JSON.parse(gh('run','view',runId,'--repo',repo,'--json','status,conclusion,headSha'));assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.headSha,commit);
const input=path.resolve('artifacts/raw'),output=path.resolve('artifacts/release');fs.mkdirSync(output,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(input,'build-manifest.json'),'utf8').replace(/^\ufeff/,''));assert.equal(manifest.commit,commit);assert.equal(manifest.version,'0.4.0');assert.equal(manifest.installerSmoke,'passed');
for(const line of fs.readFileSync(path.join(input,'SHA256SUMS.txt'),'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/)){const separator=line.indexOf('  '),expected=line.slice(0,separator),name=line.slice(separator+2);assert.ok(separator>0);assert.equal(path.basename(name),name);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(input,name))).digest('hex'),expected.toLowerCase());}
const exe=fs.readdirSync(input).filter(n=>n.endsWith('.exe')),msi=fs.readdirSync(input).filter(n=>n.endsWith('.msi'));assert.equal(exe.length,1);assert.equal(msi.length,1);
assert.equal(fs.readFileSync(path.join(input,exe[0])).subarray(0,2).toString(),'MZ');assert.equal(fs.readFileSync(path.join(input,msi[0])).subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
for(const [source,destination] of [[exe[0],'SurveyStudio-Pro-0.4.0-Windows-x64-setup.exe'],[msi[0],'SurveyStudio-Pro-0.4.0-Windows-x64.msi'],['INSTALLATION_WINDOWS.md','INSTALLATION_WINDOWS.md'],['build-manifest.json','build-manifest.json']])fs.copyFileSync(path.join(input,source),path.join(output,destination));
const sums=fs.readdirSync(output).filter(n=>n!=='SHA256SUMS.txt').sort().map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')+'  '+name);fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),sums.join('\n')+'\n');
const files=fs.readdirSync(output).sort(),draft=JSON.parse(gh('release','view',tag,'--repo',repo,'--json','isDraft,targetCommitish,assets'));assert.equal(draft.isDraft,true);assert.equal(draft.targetCommitish,commit);assert.ok(draft.assets.every(a=>files.includes(a.name)),'Unerwartete bestehende Release-Dateien.');
gh('release','upload',tag,...files.map(name=>path.join(output,name)),'--repo',repo,'--clobber');
const uploaded=JSON.parse(gh('release','view',tag,'--repo',repo,'--json','isDraft,assets'));assert.equal(uploaded.isDraft,true);assert.deepEqual(uploaded.assets.map(a=>a.name).sort(),files);for(const asset of uploaded.assets)assert.equal(asset.size,fs.statSync(path.join(output,asset.name)).size);
gh('release','edit',tag,'--repo',repo,'--draft=false','--prerelease');
const published=JSON.parse(gh('release','view',tag,'--repo',repo,'--json','url,isDraft,isPrerelease,targetCommitish'));assert.equal(published.isDraft,false);assert.equal(published.isPrerelease,true);assert.equal(published.targetCommitish,commit);console.log(published.url);
