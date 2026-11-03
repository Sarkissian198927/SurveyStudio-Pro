import {isDesktop} from './local';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, ShieldCheck } from 'lucide-react';
import type { SurveyDraft } from '@surveystudio/shared';
import { api } from './api';

import { SurveyForm } from './SurveyForm';

export function PublicSurveyPage(){
 const {slug,invite}=useParams();const [draft,setDraft]=useState<SurveyDraft|null>(null),[error,setError]=useState('');
 const submissionKey=useRef(crypto.randomUUID());const publicSlug=useRef(slug||'');
 useEffect(()=>{if(!slug&&!invite)return;setError('');setDraft(null);api<{document:SurveyDraft;slug?:string}>(invite?`/public/invites/${encodeURIComponent(invite)}`:`/public/s/${encodeURIComponent(slug!)}`).then(r=>{publicSlug.current=r.slug||slug!;setDraft(r.document);}).catch(e=>setError(e.message));},[slug,invite]);
 async function submit(answers:Record<string,unknown>,consent?:{accepted:boolean;noticeRevision?:string}){await api(`/public/s/${encodeURIComponent(publicSlug.current)}/responses`,{method:'POST',body:JSON.stringify({idempotencyKey:submissionKey.current,answers,consent,...invite?{inviteToken:invite}:{}})});}
 if(error)return <div className="public-error"><div><ClipboardList size={29}/><h2>Diese Umfrage ist nicht verfügbar.</h2><p>{error}</p><Link to="/app">Zu SurveyStudio <ArrowRight size={16}/></Link></div></div>;
 if(!draft)return <div className="center-screen"><Loader2 className="spin"/> Umfrage wird geladen ...</div>;
 return <div className="public-wrapper"><header className="public-header"><span className="public-brand"><ClipboardList size={19}/> SurveyStudio Pro</span><span><ShieldCheck size={15}/> {isDesktop()?'Lokaler Fragebogen':'Öffentlicher Fragebogen'}</span></header><SurveyForm draft={draft} onSubmit={submit}/><footer className="public-footer">{isDesktop()&&<Link to="/app">Zur Übersicht</Link>}<CheckCircle2 size={14}/> Erstellt mit SurveyStudio Pro</footer></div>;
}
