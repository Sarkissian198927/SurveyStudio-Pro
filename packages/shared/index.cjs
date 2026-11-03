'use strict';
const core=require('./core.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const extras=[['rating','Sterne'],['slider','Schieberegler'],['nps','Net Promoter Score'],['likert','Likert-Skala'],['matrix_single','Matrix – Einfachauswahl'],['matrix_multi','Matrix – Mehrfachauswahl'],['ranking','Rangfolge'],['image_choice','Bildauswahl'],['file_upload','Datei-Upload'],['time_slot','Terminwahl']];
const QUESTION_TYPES=[...core.QUESTION_TYPES,...extras.map(([id,label])=>({id,label,icon:'list'}))];
const types=new Set(QUESTION_TYPES.map(x=>x.id));
const numeric=new Set(['number','rating','slider','nps']);
const choices=new Set(['single_choice','multi_choice','dropdown','likert','image_choice','time_slot','ranking']);
const matrices=new Set(['matrix_single','matrix_multi']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const empty=x=>x==null||x===''||(typeof x==='string'&&!x.trim())||(Array.isArray(x)&&!x.length);
function createDraft(title) {
 const d=core.createDraft(title);
 Object.assign(d.theme,{backgroundMode:'solid',secondaryColor:'#dbeafe',gradientAngle:135,pattern:'dots',backgroundSize:'cover',backgroundPosition:'center',overlayOpacity:0.15,paperOpacity:1});
 d.metadata.header='';d.metadata.footer='';d.logic=[];
 d.privacy.retentionDays=365;d.privacy.minGroupSize=5;
 return d;
}
function newQuestion(type) {
 if(!types.has(type))throw TypeError('Unbekannter Fragetyp');
 const base=core.newQuestion(core.QUESTION_TYPES.some(x=>x.id===type)?type:numeric.has(type)?'number':choices.has(type)||matrices.has(type)?'single_choice':'short_text');
 base.type=type;
 if(type==='rating')base.validation={min:1,max:5};
 if(type==='slider')base.validation={min:0,max:100,step:1};
 if(type==='nps')base.validation={min:0,max:10};
 if(matrices.has(type))base.rows=[{value:'row_1',label:'Aussage 1'},{value:'row_2',label:'Aussage 2'}];
 if(type==='likert')base.options=['Stimme gar nicht zu','Stimme eher nicht zu','Neutral','Stimme eher zu','Stimme völlig zu'].map((label,i)=>({value:String(i+1),label}));
 return base;
}
function orderDraft(d){const byKey=new Map(d.questions.map(q=>[q.key,q]));d.questions=d.pages.flatMap(p=>p.questionKeys).map(k=>byKey.get(k)).filter(Boolean);return d;}
function addQuestion(draft,type,pageKey) {
 const d=clone(draft),q=newQuestion(type);d.questions.push(q);(d.pages.find(p=>p.key===pageKey)||d.pages[d.pages.length-1]).questionKeys.push(q.key);return orderDraft(d);
}
function duplicateQuestion(draft,key) {
 const d=clone(draft),q=d.questions.find(q=>q.key===key);if(!q)return d;
 const copy={...clone(q),key:crypto.randomUUID(),label:q.label+' (Kopie)'};
 d.questions.push(copy);const p=d.pages.find(p=>p.questionKeys.includes(key));p.questionKeys.splice(p.questionKeys.indexOf(key)+1,0,copy.key);return orderDraft(d);
}
function removeQuestion(draft,key) {
 const d=core.removeQuestion(draft,key);
 for(const p of d.pages)if(p.nextRules)p.nextRules=p.nextRules.filter(r=>!r.when.conditions.some(c=>c.questionKey===key));
 for(const q of d.questions){for(const prop of ['visibility','requiredWhen'])if(q[prop]?.conditions?.some(c=>c.questionKey===key))delete q[prop];}return d;
}
function moveQuestion(draft,key,offset) {
 const d=clone(draft),p=d.pages.find(p=>p.questionKeys.includes(key));if(!p)return d;
 const i=p.questionKeys.indexOf(key),to=i+offset;if(to<0||to>=p.questionKeys.length)return d;p.questionKeys.splice(to,0,p.questionKeys.splice(i,1)[0]);return orderDraft(d);
}
function normalQuestion(q) {const n=clone(q);if(numeric.has(q.type))n.type='number';else if(matrices.has(q.type)||choices.has(q.type))n.type=['multi_choice','ranking'].includes(q.type)?'multi_choice':q.type==='matrix_multi'?'multi_choice':'single_choice';else if(q.type==='file_upload')n.type='short_text';if(!['single_choice','multi_choice','dropdown'].includes(n.type))n.options=[];return n;}
function validRule(rule,keys) {return object(rule)&&['all','any'].includes(rule.mode)&&Array.isArray(rule.conditions)&&rule.conditions.length>0&&rule.conditions.length<=20&&rule.conditions.every(c=>object(c)&&keys.has(c.questionKey)&&['eq','neq','contains','gt','lt','answered'].includes(c.operator)&&(['string','number','boolean'].includes(typeof c.value)||c.operator==='answered'));}
function validFile(value) {
 if(!object(value)||typeof value.name!=='string'||value.name.length>200||!Number.isInteger(value.size)||value.size<1||value.size>1400000||typeof value.data!=='string'||value.data.length>2000000)return false;
 const m=value.data.match(/^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);if(!m||m[1]!==value.mime)return false;
 try{const bytes=atob(m[2]);if(bytes.length!==value.size)return false;return value.mime==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):value.mime==='image/jpeg'?bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255:value.mime==='image/webp'?bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP':bytes.startsWith('%PDF-');}catch{return false;}
}
function validateDraft(draft,publish=false,requirePrivacy=false) {
 if(!object(draft))return core.validateDraft(draft,publish);
 if(JSON.stringify(draft).length>20000000)return {ok:false,errors:['Fragebogen insgesamt zu groß (maximal 20 MB).']};
 const d=clone(draft),errors=[];
 if(!Array.isArray(d.pages)||!d.pages.length||d.pages.length>30||d.pages.some(p=>!object(p)||typeof p.key!=='string'||!p.key||typeof p.title!=='string'||p.title.length>160||!Array.isArray(p.questionKeys)))return {ok:false,errors:['Ungültige Fragebogenseiten (1 bis 30).']};
 const all=d.pages.flatMap(p=>p.questionKeys),pageKeys=d.pages.map(p=>p.key);
 if(new Set(pageKeys).size!==pageKeys.length)errors.push('Doppelte Seiten-ID.');
 const questions=Array.isArray(d.questions)?d.questions:[];
 const keys=new Set(questions.map(q=>q?.key));
 if(all.length!==questions.length||new Set(all).size!==all.length||all.some(k=>!keys.has(k)))errors.push('Jede Frage muss genau einer Seite zugeordnet sein.');
 for(const q of questions) {
  if(!object(q)||!types.has(q.type)){errors.push('Unbekannter Fragetyp.');continue;}
  if(matrices.has(q.type)&&(!Array.isArray(q.rows)||!q.rows.length||q.rows.length>30||q.rows.some(r=>!object(r)||typeof r.value!=='string'||!r.value||typeof r.label!=='string'||!r.label.trim()||r.label.length>200)||new Set(q.rows.map(r=>r.value)).size!==q.rows.length))errors.push('Matrixzeilen ungültig.');
  if(q.type==='image_choice'&&Array.isArray(q.options)&&q.options.some(o=>o.image!==undefined&&(typeof o.image!=='string'||o.image.length>500000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(o.image))))errors.push('Ungültiges Auswahlbild.');
  for(const prop of ['visibility','requiredWhen'])if(q[prop]!==undefined&&!validRule(q[prop],keys))errors.push('Ungültige Bedingung: '+q.label);
  if(q.type==='nps'&&(q.validation?.min!==0||q.validation?.max!==10))errors.push('NPS verwendet die feste Skala 0 bis 10.');
  if(q.type==='rating'&&(q.validation?.min!==1||!Number.isInteger(q.validation?.max)||q.validation.max<1||q.validation.max>10))errors.push('Sternebewertung: 1 bis maximal 10 Sterne.');
  if(q.type==='slider'&&(!Number.isFinite(q.validation?.min)||!Number.isFinite(q.validation?.max)||q.validation.min>=q.validation.max))errors.push('Schieberegler benötigt einen gültigen Minimal- und Maximalwert.');
  if(q.style&&['bold','italic'].some(k=>q.style[k]!==undefined&&typeof q.style[k]!=='boolean'))errors.push('Ungültiger Schriftstil.');
  if(q.validation?.step!==undefined&&(!(q.validation.step>0)||!Number.isFinite(q.validation.step)))errors.push('Schrittweite muss positiv sein.');
 }
 const pageForQuestion=new Map(draft.pages.flatMap((p,i)=>p.questionKeys.map(k=>[k,i])));
 for(const q of questions)for(const prop of ['visibility','requiredWhen'])if(Array.isArray(q?.[prop]?.conditions))for(const condition of q[prop].conditions)if(pageForQuestion.get(condition.questionKey)>pageForQuestion.get(q.key))errors.push('Bedingungen dürfen nicht von einer späteren Seite abhängen.');
 for(const [i,page] of draft.pages.entries())if(page.nextRules!==undefined){if(!Array.isArray(page.nextRules)||page.nextRules.length>20)errors.push('Ungültige Seitensprünge.');else for(const rule of page.nextRules){if(!object(rule)||!validRule(rule.when,keys)||(rule.target!=='__end__'&&draft.pages.findIndex(p=>p.key===rule.target)<=i))errors.push('Seitensprünge müssen auf spätere Seiten oder zum Abschluss führen.');else if(rule.when.conditions.some(c=>pageForQuestion.get(c.questionKey)>i))errors.push('Seitensprung hängt von einer zukünftigen Antwort ab.');}}
 const visiting=new Set(),visited=new Set();
 function visit(key){if(visiting.has(key)){errors.push('Zyklus in der Fragenlogik.');return;}if(visited.has(key))return;visiting.add(key);const q=questions.find(q=>q?.key===key);for(const prop of ['visibility','requiredWhen'])for(const c of Array.isArray(q?.[prop]?.conditions)?q[prop].conditions:[])visit(c.questionKey);visiting.delete(key);visited.add(key);}
 for(const q of questions)visit(q?.key);
 d.pages=[{...d.pages[0],questionKeys:all}];d.questions=questions.filter(object).map(normalQuestion);
 if(d.privacy&&['anonymous','pseudonymous','identifiable'].includes(d.privacy.mode))d.privacy.mode='anonymous';
 for(const field of ['backgroundImage','logoImage'])if(/^\/api\/v1\/public\/assets\/[0-9a-f-]{36}$/.test(d.theme?.[field]||''))d.theme[field]=null;
 const base=core.validateDraft(d,publish);errors.push(...base.errors);
 if(draft.privacy){for(const field of ['controller','contact','purpose','legalBasis','noticeRevision','consentText'])if(draft.privacy[field]!==undefined&&(typeof draft.privacy[field]!=='string'||draft.privacy[field].length>4000))errors.push('Ungültige Datenschutzangabe.');if(draft.privacy.noticeRevision?.length>80)errors.push('Hinweisversion maximal 80 Zeichen.');if(draft.privacy.requireConsent!==undefined&&typeof draft.privacy.requireConsent!=='boolean')errors.push('Ungültige Bestätigungseinstellung.');if(draft.privacy.requireConsent===true&&(!(typeof draft.privacy.consentText==='string'&&draft.privacy.consentText.trim())||!(typeof draft.privacy.noticeRevision==='string'&&draft.privacy.noticeRevision.trim())))errors.push('Bestätigung benötigt Text und Hinweisversion.');if(publish&&requirePrivacy&&['controller','contact','purpose','legalBasis','noticeRevision'].some(k=>typeof draft.privacy[k]!=='string'||!draft.privacy[k].trim()))errors.push('Vor Produktivveröffentlichung Verantwortlichen, Kontakt, Zweck, Rechtsgrundlage und Hinweisversion ausfüllen.');}
 const theme=draft.theme;
 if(object(theme)) {
  if(theme.backgroundMode!==undefined&&!['solid','gradient','pattern','image'].includes(theme.backgroundMode))errors.push('Ungültiger Hintergrundmodus.');
  if(theme.secondaryColor!==undefined&&!/^#[0-9a-f]{6}$/i.test(theme.secondaryColor))errors.push('Ungültige zweite Hintergrundfarbe.');
  if(theme.gradientAngle!==undefined&&(!Number.isFinite(theme.gradientAngle)||theme.gradientAngle<0||theme.gradientAngle>360))errors.push('Ungültiger Verlaufswinkel.');
  if(theme.pattern!==undefined&&!['dots','grid','diagonal'].includes(theme.pattern))errors.push('Ungültiges Hintergrundmuster.');
  if(theme.backgroundSize!==undefined&&!['cover','contain','repeat'].includes(theme.backgroundSize))errors.push('Ungültige Bildskalierung.');
  if(theme.backgroundPosition!==undefined&&!['center','top','bottom','left','right'].includes(theme.backgroundPosition))errors.push('Ungültige Bildposition.');
  for(const p of ['overlayOpacity','paperOpacity'])if(theme[p]!==undefined&&(!Number.isFinite(theme[p])||theme[p]<0||theme[p]>1))errors.push('Ungültige Transparenz.');
 }
 for(const p of ['header','footer'])if(draft.metadata?.[p]!==undefined&&(typeof draft.metadata[p]!=='string'||draft.metadata[p].length>4000))errors.push('Kopf-/Fußzeile ungültig.');
 if(draft.privacy?.retentionDays!==undefined&&(!Number.isInteger(draft.privacy.retentionDays)||draft.privacy.retentionDays<1||draft.privacy.retentionDays>3650))errors.push('Löschfrist: 1 bis 3650 Tage.');
 if(draft.privacy?.minGroupSize!==undefined&&(!Number.isInteger(draft.privacy.minGroupSize)||draft.privacy.minGroupSize<5||draft.privacy.minGroupSize>100))errors.push('Mindestgruppengröße: 5 bis 100.');
 return {ok:!errors.length,errors:[...new Set(errors)]};
}
function evaluateRule(rule,answers,visible=()=>true) {
 if(!rule)return true;
 const matches=rule.conditions.map(c=>{
  const v=visible(c.questionKey)?answers[c.questionKey]:undefined;
  switch(c.operator){case'answered':return !empty(v);case'eq':return v===c.value;case'neq':return !empty(v)&&v!==c.value;case'contains':return Array.isArray(v)?v.includes(c.value):typeof v==='string'&&v.includes(String(c.value));case'gt':return typeof v==='number'&&v>c.value;case'lt':return typeof v==='number'&&v<c.value;default:return false;}
 });return rule.mode==='any'?matches.some(Boolean):matches.every(Boolean);
}
function surveyFlow(draft,answers) {
 const reached=new Set(),ordered=[],questions=new Map(draft.questions.map(q=>[q.key,q])),pageFor=new Map(draft.pages.flatMap(p=>p.questionKeys.map(k=>[k,p.key]))),memo=new Map(),visiting=new Set();
 function visible(key){if(!reached.has(pageFor.get(key)))return false;if(memo.has(key))return memo.get(key);if(visiting.has(key))return false;visiting.add(key);const q=questions.get(key);const result=!!q&&evaluateRule(q.visibility,answers,visible);visiting.delete(key);memo.set(key,result);return result;}
 let index=0;
 while(index<draft.pages.length){const page=draft.pages[index];if(reached.has(page.key))break;reached.add(page.key);ordered.push(page);memo.clear();const jump=(page.nextRules||[]).find(rule=>evaluateRule(rule.when,answers,visible));if(jump?.target==='__end__')break;if(jump){const next=draft.pages.findIndex(p=>p.key===jump.target);if(next<=index)break;index=next;}else index++;}
 memo.clear();return {pages:ordered,questions:draft.questions.filter(q=>visible(q.key))};
}
function visibleQuestions(draft,answers){return surveyFlow(draft,answers).questions;}
function flowPages(draft,answers){return surveyFlow(draft,answers).pages;}
function cleanAnswers(draft,answers) {const visible=visibleQuestions(draft,answers);return Object.fromEntries(Object.entries(answers).filter(([key])=>visible.some(q=>q.key===key)));}
function validateAnswers(draft,answers,questionKeys) {
 if(!object(answers))return {ok:false,errors:['Antworten müssen ein Objekt sein.']};
 if(JSON.stringify(answers).length>20000000)return {ok:false,errors:['Antwortdateien insgesamt zu groß (maximal 20 MB).']};
 const errors=[];if(Object.keys(answers).some(k=>!draft.questions.some(q=>q.key===k)))errors.push('Unbekannte Frage in der Antwort.');
 const visible=visibleQuestions(draft,answers),visibleSet=new Set(visible.map(q=>q.key));
 for(const original of visible) {
  if(questionKeys&&!questionKeys.includes(original.key))continue;
  const q=clone(original),v=answers[q.key];
  q.required=q.required||!!q.requiredWhen&&evaluateRule(q.requiredWhen,answers,k=>visibleSet.has(k));
  if(empty(v)){if(q.required)errors.push('Bitte beantworten: '+q.label);continue;}
  const options=new Set(q.options.map(o=>o.value));
  if(matrices.has(q.type)){
   if(!object(v)||Object.keys(v).some(k=>!q.rows.some(r=>r.value===k))||q.rows.some(r=>q.required&&empty(v[r.value])||!empty(v[r.value])&&(q.type==='matrix_multi'? !Array.isArray(v[r.value])||new Set(v[r.value]).size!==v[r.value].length||v[r.value].some(x=>!options.has(x)):!options.has(v[r.value]))))errors.push('Ungültige Matrix: '+q.label);
  } else if(q.type==='ranking') {
   if(!Array.isArray(v)||v.length!==q.options.length||new Set(v).size!==v.length||v.some(x=>!options.has(x)))errors.push('Bitte alle Optionen eindeutig ordnen: '+q.label);
  } else if(q.type==='file_upload') {
   if(!validFile(v))errors.push('Ungültige Datei (PNG/JPG/WebP/PDF, maximal 1,4 MB): '+q.label);
  } else {
   const normal=normalQuestion(q);const result=core.validateAnswers({...draft,questions:[normal]},{[q.key]:v});errors.push(...result.errors);
   if(numeric.has(q.type)&&q.type!=='number'&&(!Number.isInteger(v)&&q.type!=='slider'))errors.push('Ganzzahlige Bewertung erforderlich: '+q.label);
   if(q.type==='slider'&&q.validation?.step&&Math.abs((v-(q.validation.min||0))/q.validation.step-Math.round((v-(q.validation.min||0))/q.validation.step))>1e-8)errors.push('Ungültige Schrittweite: '+q.label);
  }
 }
 return {ok:!errors.length,errors};
}
function backgroundStyle(theme) {
 const color=/^#[0-9a-f]{6}$/i.test(theme.backgroundColor)?theme.backgroundColor:'#f6f8fc',second=/^#[0-9a-f]{6}$/i.test(theme.secondaryColor)?theme.secondaryColor:'#dbeafe';
 const mode=theme.backgroundMode||(theme.backgroundImage?'image':'solid');
 const style={backgroundColor:color};
 if(mode==='gradient')style.backgroundImage=`linear-gradient(${Number(theme.gradientAngle)||0}deg,${color},${second})`;
 if(mode==='pattern'){
  const patterns={dots:`radial-gradient(${second} 1.5px,transparent 1.5px)`,grid:`linear-gradient(${second} 1px,transparent 1px),linear-gradient(90deg,${second} 1px,transparent 1px)`,diagonal:`repeating-linear-gradient(45deg,transparent,transparent 12px,${second} 12px,${second} 14px)`};
  style.backgroundImage=patterns[theme.pattern]||patterns.dots;style.backgroundSize='24px 24px';
 }
 if(mode==='image'&&typeof theme.backgroundImage==='string'&&(/^(?:data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|\/api\/v1\/public\/assets\/[0-9a-f-]{36})$/.test(theme.backgroundImage))){
  const alpha=Math.max(0,Math.min(1,theme.overlayOpacity??0.15));style.backgroundImage=`linear-gradient(rgba(255,255,255,${alpha}),rgba(255,255,255,${alpha})),url(${theme.backgroundImage})`;
  style.backgroundSize=theme.backgroundSize==='contain'?'contain':theme.backgroundSize==='repeat'?'auto':'cover';style.backgroundRepeat=theme.backgroundSize==='repeat'?'repeat':'no-repeat';style.backgroundPosition=['center','top','bottom','left','right'].includes(theme.backgroundPosition)?theme.backgroundPosition:'center';
 }
 return style;
}
function calculateResults(draft,rows,totalResponses) {
 const base=core.calculateResults({...draft,questions:draft.questions.map(normalQuestion)},rows,totalResponses);
 for(const result of base.questions){const q=draft.questions.find(q=>q.key===result.key);result.type=q.type;const values=rows.filter(r=>r.question_key===q.key).map(r=>r.answer_json);
  if(numeric.has(q.type)&&values.length){const a=values.filter(x=>typeof x==='number').sort((a,b)=>a-b);result.median=a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;result.stddev=Math.sqrt(a.reduce((s,x)=>s+(x-result.mean)**2,0)/a.length);result.min=a[0];result.max=a[a.length-1];if(q.type==='nps')result.nps=Math.round(100*(a.filter(x=>x>=9).length-a.filter(x=>x<=6).length)/a.length);}
  if(matrices.has(q.type))result.matrix=q.rows.map(row=>({label:row.label,counts:q.options.map(o=>({label:o.label,count:values.filter(v=>Array.isArray(v[row.value])?v[row.value].includes(o.value):v[row.value]===o.value).length}))}));
  if(q.type==='ranking')result.ranking=q.options.map(o=>({label:o.label,meanRank:values.length?values.reduce((s,v)=>s+v.indexOf(o.value)+1,0)/values.length:0})).sort((a,b)=>a.meanRank-b.meanRank);
 }return base;
}
function validateConsent(draft,consent){return !draft.privacy.requireConsent||object(consent)&&consent.accepted===true&&consent.noticeRevision===draft.privacy.noticeRevision;}
function canonicalJson(value){if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';return JSON.stringify(value);}
module.exports={QUESTION_TYPES,newQuestion,createDraft,addQuestion,duplicateQuestion,removeQuestion,moveQuestion,validateDraft,validateAnswers,calculateResults,backgroundStyle,evaluateRule,visibleQuestions,flowPages,cleanAnswers,canonicalJson,validateConsent};
