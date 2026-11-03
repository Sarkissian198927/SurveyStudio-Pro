import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { backgroundStyle, flowPages,validateConsent,cleanAnswers, validateAnswers, visibleQuestions, type SurveyDraft, type SurveyQuestion } from '@surveystudio/shared';
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react';

type Props={draft:SurveyDraft;preview?:boolean;onSubmit?:(answers:Record<string,unknown>,consent?:{accepted:boolean;noticeRevision?:string})=>Promise<void>};
/** Deliberately small formatting vocabulary, rendered as React nodes; never execute supplied HTML. */
export function FormattedText({text}:{text:string}) {
 return <>{text.split('\n').map((line,i)=><p key={i}>{line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part,j)=>part.startsWith('**')?<strong key={j}>{part.slice(2,-2)}</strong>:part.startsWith('*')?<em key={j}>{part.slice(1,-1)}</em>:part)}</p>)}</>;
}
export function SurveyForm({draft,preview=false,onSubmit}:Props) {
 const [answers,setAnswers]=useState<Record<string,unknown>>({}),[error,setError]=useState(''),[sending,setSending]=useState(false),[complete,setComplete]=useState(false),[started,setStarted]=useState(false),[page,setPage]=useState(0);
 const [consentAccepted,setConsentAccepted]=useState(false);
 const form=useRef<HTMLFormElement>(null);
 const route=flowPages(draft,answers),routeIndex=Math.max(0,route.findIndex(p=>p.key===draft.pages[page]?.key)),lastPage=routeIndex===route.length-1;
 const visible=visibleQuestions(draft,answers),keys=new Set(draft.pages[Math.min(page,draft.pages.length-1)].questionKeys);
 const sorted=draft.pages[Math.min(page,draft.pages.length-1)].questionKeys.map(key=>visible.find(q=>q.key===key)).filter((q):q is SurveyQuestion=>!!q);
 useEffect(()=>{const cleaned=cleanAnswers(draft,answers);if(JSON.stringify(cleaned)!==JSON.stringify(answers))setAnswers(cleaned);},[draft,answers]);
 function fail(message:string){setError(message);setTimeout(()=>form.current?.querySelector<HTMLElement>('[aria-invalid="true"] input,[aria-invalid="true"] textarea,[aria-invalid="true"] select,[role="alert"]')?.focus(),0);}
 async function submit(e:FormEvent){
  e.preventDefault();
  if(form.current?.querySelector('[data-uploading="true"]')){fail('Bitte warten, bis die Datei vollständig gelesen wurde.');return;}if(form.current?.querySelector('[data-file-error="true"]')){fail('Bitte den fehlerhaften Dateiupload entfernen oder ersetzen.');return;}
  const result=validateAnswers(draft,answers,lastPage?undefined:draft.pages[page].questionKeys);
  if(!result.ok){fail(result.errors[0]);return;}setError('');
  if(!lastPage){setPage(draft.pages.findIndex(p=>p.key===route[routeIndex+1].key));return;}
  const consent={accepted:consentAccepted,noticeRevision:draft.privacy.noticeRevision};if(!validateConsent(draft,consent)){fail('Bitte den Datenschutzhinweis bestätigen.');return;}
  setSending(true);try{if(!preview)await onSubmit?.(cleanAnswers(draft,answers),draft.privacy.requireConsent?consent:undefined);setComplete(true);}catch(e){fail(e instanceof Error?e.message:'Übertragung fehlgeschlagen. Bitte erneut versuchen.');}finally{setSending(false);}
 }
 const style={...backgroundStyle(draft.theme),color:draft.theme.textColor,fontFamily:draft.theme.fontFamily,'--survey-accent':draft.theme.primaryColor} as CSSProperties;
 return <div className="survey-runtime" style={style}><div className="survey-paper" style={{backgroundColor:`rgba(255,255,255,${draft.theme.paperOpacity??1})`}}>
  {preview&&<div className="preview-ribbon">VORSCHAU · Antworten werden nicht gespeichert</div>}
  {draft.metadata.header&&<header className="survey-custom-header"><FormattedText text={draft.metadata.header}/></header>}
  {draft.theme.logoImage&&<img className="survey-logo" src={draft.theme.logoImage} alt="Umfragelogo"/>}
  {complete?<div className="runtime-message" role="status"><CheckCircle2 size={44}/><h1>Geschafft!</h1><FormattedText text={draft.metadata.outro}/>{preview&&<button className="outline-btn" onClick={()=>{setComplete(false);setAnswers({});setStarted(false);setPage(0);}}>Vorschau neu starten</button>}</div>
  :!started?<div className="runtime-message intro-message"><h1>{draft.metadata.title}</h1><FormattedText text={draft.metadata.intro}/><FormattedText text={draft.metadata.description}/><button className="primary-btn" onClick={()=>setStarted(true)}>Umfrage starten <ArrowRight size={17}/></button><p className="notice"><strong>{draft.privacy.mode==='anonymous'?'Anonyme Erhebung':draft.privacy.mode==='pseudonymous'?'Pseudonyme Erhebung':'Personenbezogene Erhebung'}</strong><br/>{draft.privacy.privacyNotice}</p></div>
  :<form ref={form} onSubmit={submit} noValidate>
    <h1>{draft.metadata.title}</h1><h2 tabIndex={-1}>{draft.pages[page].title}</h2>
    {draft.settings.showProgress&&<div className="survey-progress"><label htmlFor="survey-progress">Seite {routeIndex+1} von {route.length}</label><progress id="survey-progress" value={routeIndex+1} max={route.length}/></div>}
    {sorted.map((q,i)=><fieldset className="runtime-question" key={q.key} data-question-type={q.type} aria-invalid={!!error&&error.includes(q.label)} aria-describedby={error&&error.includes(q.label)?'survey-error':undefined}>
      <legend className="runtime-question-label" style={{fontWeight:q.style?.bold?800:600,fontStyle:q.style?.italic?'italic':'normal',color:q.style?.color||draft.theme.textColor}}>{i+1}. {q.label} {q.required&&<span className="required" aria-label="Pflichtfrage">*</span>}</legend>
      {q.description&&<p className="question-help">{q.description}</p>}<AnswerInput q={q} value={answers[q.key]} onChange={value=>{setAnswers(old=>({...old,[q.key]:value}));setError('');}}/>
    </fieldset>)}
    {error&&<p id="survey-error" className="form-error" role="alert" tabIndex={-1}>{error}</p>}
    {lastPage&&draft.privacy.requireConsent&&<label className="choice-option"><input type="checkbox" checked={consentAccepted} onChange={e=>setConsentAccepted(e.target.checked)} aria-required="true"/>{draft.privacy.consentText}</label>}<div className="form-actions"><button type="button" className="link-btn" disabled={sending} onClick={()=>{setError('');routeIndex?setPage(draft.pages.findIndex(p=>p.key===route[routeIndex-1].key)):setStarted(false);}}><ArrowLeft size={16}/> Zurück</button><button className="primary-btn" type="submit" disabled={sending}>{sending?'Wird übertragen …':!lastPage?'Weiter':preview?'Vorschau abschließen':'Antworten senden'} <Send size={16}/></button></div>
    <p className="notice"><strong>{draft.privacy.mode==='anonymous'?'Anonyme Erhebung':draft.privacy.mode==='pseudonymous'?'Pseudonyme Erhebung':'Personenbezogene Erhebung'}</strong><br/>{draft.privacy.privacyNotice}</p>
  </form>}
  {(draft.privacy.controller||draft.privacy.purpose)&&<section className="notice"><strong>Datenschutzinformationen</strong><p>Verantwortlich: {draft.privacy.controller} · Kontakt: {draft.privacy.contact}</p><p>Zweck: {draft.privacy.purpose}</p><p>Rechtsgrundlage: {draft.privacy.legalBasis} · Speicherdauer: {draft.privacy.retentionDays} Tage · Hinweisversion: {draft.privacy.noticeRevision}</p></section>}{draft.metadata.footer&&<footer className="survey-custom-footer"><FormattedText text={draft.metadata.footer}/></footer>}
 </div></div>;
}
function AnswerInput({q,value,onChange}:{q:SurveyQuestion;value:unknown;onChange:(value:unknown)=>void}) {
 const [fileError,setFileError]=useState(''),[fileLoading,setFileLoading]=useState(false);const fileReader=useRef<FileReader|null>(null),fileInput=useRef<HTMLInputElement>(null);useEffect(()=>()=>{fileReader.current?.abort();},[]);
 const common={className:'runtime-input','aria-label':q.label};
 if(['short_text','email','date','time_slot'].includes(q.type)&&q.type!=='time_slot')return <input {...common} type={q.type==='short_text'?'text':q.type} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}/>;
 if(q.type==='long_text')return <textarea {...common} rows={4} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}/>;
 if(['number','rating','nps','slider'].includes(q.type))return <div><input {...common} type={q.type==='slider'?'range':'number'} min={q.validation?.min} max={q.validation?.max} step={q.validation?.step??(q.type==='number'?'any':1)} value={typeof value==='number'?value:q.type==='slider'?q.validation?.min??0:''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/>{q.type==='slider'&&<output>{typeof value==='number'?value:'Bitte Regler bewegen'}</output>}{q.type==='rating'&&<span aria-hidden="true"> {'★'.repeat(typeof value==='number'?Math.max(0,Math.min(10,value)):0)}</span>}{q.type==='nps'&&<p className="hint">0 = sehr unwahrscheinlich · 10 = sehr wahrscheinlich</p>}</div>;
 if(q.type==='file_upload')return <div data-uploading={fileLoading} data-file-error={!!fileError}><input ref={fileInput} {...common} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>{const f=e.target.files?.[0];fileReader.current?.abort();fileReader.current=null;setFileLoading(false);setFileError('');onChange(null);if(!f){onChange(null);return;}if(f.size>1400000||!['image/png','image/jpeg','image/webp','application/pdf'].includes(f.type)){setFileError('PNG/JPG/WebP/PDF bis 1,4 MB.');return;}const reader=new FileReader();fileReader.current=reader;setFileLoading(true);reader.onerror=()=>{if(fileReader.current!==reader)return;setFileLoading(false);setFileError('Datei konnte nicht gelesen werden.');};reader.onload=()=>{if(fileReader.current!==reader)return;setFileLoading(false);onChange({name:f.name,mime:f.type,size:f.size,data:reader.result});};reader.readAsDataURL(f);}}/><button type="button" onClick={()=>{fileReader.current?.abort();fileReader.current=null;setFileLoading(false);setFileError('');if(fileInput.current)fileInput.current.value='';onChange(null);}}>Datei entfernen</button>{fileLoading&&<p role="status">Datei wird gelesen …</p>}{fileError&&<p role="alert">{fileError}</p>}</div>;
 if(q.type==='ranking'){
  const order=Array.isArray(value)?value as string[]:q.options.map(o=>o.value);
  const move=(index:number,delta:number)=>{const list=[...order];list.splice(index+delta,0,list.splice(index,1)[0]);onChange(list);};
  return <div><ol>{order.map((key,i)=><li key={key}>{q.options.find(o=>o.value===key)?.label} <button type="button" aria-label={`${i+1}. Rang nach oben`} disabled={!i} onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label={`${i+1}. Rang nach unten`} disabled={i===order.length-1} onClick={()=>move(i,1)}>↓</button></li>)}</ol><button type="button" onClick={()=>onChange(order)}>Reihenfolge übernehmen</button></div>;
 }
 if(q.type==='matrix_single'||q.type==='matrix_multi'){
  const data=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
  return <div className="matrix-input">{q.rows?.map(row=><fieldset key={row.value}><legend>{row.label}</legend>{q.options.map(option=>{const selected=q.type==='matrix_multi'?Array.isArray(data[row.value])&&(data[row.value] as string[]).includes(option.value):data[row.value]===option.value;return <label className="choice-option" key={option.value}><input type={q.type==='matrix_multi'?'checkbox':'radio'} name={`${q.key}-${row.value}`} checked={!!selected} onChange={e=>{const prev=Array.isArray(data[row.value])?data[row.value] as string[]:[];onChange({...data,[row.value]:q.type==='matrix_multi'?e.target.checked?[...prev,option.value]:prev.filter(x=>x!==option.value):option.value});}}/>{option.label}</label>;})}</fieldset>)}</div>;
 }
 if(q.type==='dropdown')return <select {...common} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}><option value="">Bitte auswählen …</option>{q.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>;
 if(q.type==='boolean')return <div className="choice-list">{[true,false].map(v=><label className="choice-option" key={String(v)}><input type="radio" name={q.key} checked={value===v} onChange={()=>onChange(v)}/>{v?'Ja':'Nein'}</label>)}</div>;
 return <div className="choice-list">{q.options.map(o=><label className="choice-option" key={o.value}><input type={q.type==='multi_choice'?'checkbox':'radio'} name={q.key} checked={q.type==='multi_choice'?Array.isArray(value)&&value.includes(o.value):value===o.value} onChange={e=>{const prev=Array.isArray(value)?value as string[]:[];onChange(q.type==='multi_choice'?e.target.checked?[...prev,o.value]:prev.filter(x=>x!==o.value):o.value);}}/>{q.type==='image_choice'&&o.image&&<img src={o.image} alt="" style={{width:90,height:70,objectFit:'cover'}}/>}{o.label}</label>)}</div>;
}
