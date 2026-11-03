import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from './App';
import { api, type Project } from './api';

type Organization={id:string;name:string;role:'owner'|'admin'|'member'};
type Member={id:string;email:string;display_name:string;role:'owner'|'editor'|'viewer'|'analyst'|'guest'};
export function ProjectsPage() {
  const [organizations,setOrganizations]=useState<Organization[]>([]),[projects,setProjects]=useState<Project[]>([]);
  const [orgId,setOrgId]=useState(''),[projectId,setProjectId]=useState(''),[members,setMembers]=useState<Member[]>([]);
  const [parent,setParent]=useState('');
  const [name,setName]=useState(''),[title,setTitle]=useState(''),[rename,setRename]=useState('');
  const [email,setEmail]=useState(''),[role,setRole]=useState<Member['role']>('viewer');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const selected=projects.find(p=>p.id===projectId),org=organizations.find(o=>o.id===orgId);
  async function load() {
    const [o,p]=await Promise.all([api<Organization[]>('/organizations'),api<Project[]>('/projects')]);
    setOrganizations(o);setProjects(p);setOrgId(current=>o.some(item=>item.id===current)?current:o[0]?.id||'');setProjectId(current=>p.some(item=>item.id===current)?current:p[0]?.id||'');return p;
  }
  useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  useEffect(()=>{let active=true;setMembers([]);setRename(selected?.title??'');if(selected?.role==='owner')api<Member[]>(`/projects/${selected.id}/members`).then(data=>{if(active)setMembers(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[selected?.id,selected?.role]);
  async function act(work:()=>Promise<void>) {
    setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Aktion fehlgeschlagen.');}finally{setBusy(false);}
  }
  function submit(e:FormEvent,work:()=>Promise<void>) {e.preventDefault();void act(work);}
  async function refreshMembers() {const current=await load();if(current.find(p=>p.id===projectId)?.role==='owner')setMembers(await api<Member[]>(`/projects/${projectId}/members`));else setMembers([]);}
  return <AppShell title="Projekte und Zugriff" subtitle="Arbeitsbereiche, Projekte und Berechtigungen verwalten.">
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {loading?<p role="status">Projekte werden geladen …</p>:<div className="project-grid">
      <section className="project-panel"><h2>Arbeitsbereiche</h2>
        <label>Arbeitsbereich<select aria-label="Arbeitsbereich" className="field-input" value={orgId} onChange={e=>setOrgId(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}</select></label>
        <form onSubmit={e=>submit(e,async()=>{const o=await api<Organization>('/organizations',{method:'POST',body:JSON.stringify({name})});await load();setOrgId(o.id);setName('');setNotice('Arbeitsbereich erstellt.');})}>
          <label>Neuer Arbeitsbereich<input className="field-input" value={name} onChange={e=>setName(e.target.value)} maxLength={160} required/></label><button className="outline-btn" disabled={busy}>Arbeitsbereich erstellen</button>
        </form>
        {org&&org.role!=='member'&&<form onSubmit={e=>submit(e,async()=>{const result=await api<{message:string}>(`/organizations/${orgId}/members`,{method:'POST',body:JSON.stringify({email})});setNotice(result.message);})}>
          <h3>Bestehendes Konto hinzufügen</h3><p className="muted">Die Person muss bereits registriert sein. Projektzugriff wird anschließend separat vergeben.</p>
          <label>E-Mail des Kontos<input className="field-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><button className="outline-btn" disabled={busy}>Zum Arbeitsbereich hinzufügen</button>
        </form>}
      </section>
      <section className="project-panel"><h2>Projekte</h2>
        <label>Projekt<select aria-label="Projekt" className="field-input" value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Projekt auswählen</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title} ({p.role})</option>)}</select></label>
        {org&&org.role!=='member'&&<form onSubmit={e=>submit(e,async()=>{const p=await api<Project>('/projects',{method:'POST',body:JSON.stringify({title,organizationId:orgId,parentProjectId:parent||undefined})});await load();setProjectId(p.id);setTitle('');setNotice('Projekt erstellt.');})}>
          <label>Übergeordneter Projektordner<select aria-label="Übergeordneter Projektordner" value={parent} onChange={e=>setParent(e.target.value)}><option value="">Ohne übergeordneten Ordner</option>{projects.filter(p=>p.organization_id===orgId&&p.role!=='viewer'&&p.role!=='guest'&&p.role!=='analyst').map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>Neues Projekt in „{org.name}“<input className="field-input" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required/></label><button className="primary-btn" disabled={busy}>Projekt erstellen</button>
        </form>}
        {selected&&selected.role!=='viewer'&&<form onSubmit={e=>submit(e,async()=>{await api(`/projects/${projectId}`,{method:'PATCH',body:JSON.stringify({title:rename})});await load();setNotice('Projekt umbenannt.');})}>
          <label>Projektname<input className="field-input" value={rename} onChange={e=>setRename(e.target.value)} maxLength={160} required/></label><button className="outline-btn" disabled={busy}>Umbenennen</button>
        </form>}
        <p><Link to="/app">Zur Umfrageübersicht</Link></p>
      </section>
      {selected?.role==='owner'&&<section className="project-panel project-members"><h2>Projektzugriff: {selected.title}</h2>
        <p>Owner verwalten Zugriffe, Editor bearbeiten Inhalte, Viewer lesen. Mindestens ein Owner bleibt erhalten.</p>
        <form onSubmit={e=>submit(e,async()=>{await api(`/projects/${projectId}/members`,{method:'POST',body:JSON.stringify({email,role})});await refreshMembers();setNotice('Projektzugriff gespeichert.');})}>
          <label>E-Mail des Mitglieds<input className="field-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
          <label>Projektrolle<select className="field-input" value={role} onChange={e=>setRole(e.target.value as Member['role'])}><option value="viewer">Viewer – lesen</option><option value="editor">Editor – bearbeiten</option><option value="owner">Owner – verwalten</option><option value="analyst">Analyst – Auswertung</option><option value="guest">Gast – eingeschränkte Ansicht</option></select></label><button className="primary-btn" disabled={busy}>Projektzugriff speichern</button>
        </form>
        <ul className="member-list">{members.map(m=><li key={m.id}><span><strong>{m.display_name}</strong><br/>{m.email} · {m.role}</span><button className="outline-btn" disabled={busy} onClick={()=>void act(async()=>{await api(`/projects/${projectId}/members/${m.id}`,{method:'DELETE'});await refreshMembers();setNotice('Projektzugriff entfernt.');})} aria-label={`Zugriff von ${m.display_name} entfernen`}>Entfernen</button></li>)}</ul>
      </section>}
    </div>}
  </AppShell>;
}
