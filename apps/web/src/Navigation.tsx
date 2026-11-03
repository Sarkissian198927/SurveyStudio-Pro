import { NavLink } from 'react-router-dom';
import { BarChart3,ClipboardList,Globe,HelpCircle,LayoutDashboard,Plus,Settings,UsersRound } from 'lucide-react';
import { isDesktop } from './local';
export function Navigation({close}:{close:()=>void}){
 const items:{to:string;label:string;icon:typeof LayoutDashboard;end?:boolean}[]=[{to:'/app',label:'Übersicht',icon:LayoutDashboard,end:true},{to:'/app/surveys/new',label:'Umfrage erstellen',icon:Plus,end:true},{to:'/app/surveys',label:'Meine Umfragen',icon:ClipboardList,end:true},{to:'/app/reports',label:'Auswertungen',icon:BarChart3},{to:'/app/projects',label:'Projekte',icon:UsersRound},{to:'/app/collaboration',label:'Zusammenarbeit',icon:UsersRound},{to:'/app/online',label:'Online-Zugang',icon:Globe},{to:'/app/sync',label:'Synchronisation',icon:Settings},...(!isDesktop()?[{to:'/app/account',label:'Konto und Nachrichten',icon:Settings}]:[]),{to:'/app/help',label:'Hilfe',icon:HelpCircle}];
 return <nav className="nav-links" aria-label="Hauptnavigation" data-testid="primary-navigation">{items.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} end={end} onClick={close} className={({isActive})=>isActive?'active':''}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>;
}
