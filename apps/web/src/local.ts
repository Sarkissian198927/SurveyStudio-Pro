import { LocalStore,type SqlDriver } from '@surveystudio/desktop-store';
let store:Promise<LocalStore>|null=null;
export const isDesktop=()=> '__TAURI_INTERNALS__' in window;
export async function localStore(){if(!store)store=(async()=>{const {invoke}=await import('@tauri-apps/api/core');const database:SqlDriver={batch:operations=>invoke('sql_batch',{operations}),execute:(sql,values=[])=>invoke('sql_execute',{sql,values}),select:<T>(sql:string,values:unknown[]=[])=>invoke<T>('sql_select',{sql,values})};const result=new LocalStore(database);await result.initialize();return result;})().catch(error=>{store=null;throw error;});return store;}
export async function saveLocalFile(content:string|Uint8Array,filename='surveystudio.csv'){
 const extension=filename.split('.').pop()||'csv';const {save}=await import('@tauri-apps/plugin-dialog');const path=await save({defaultPath:filename,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});if(!path)return false;const {writeFile}=await import('@tauri-apps/plugin-fs');await writeFile(path,typeof content==='string'?new TextEncoder().encode(content):content);return true;
}
export async function downloadFile(content:Blob,filename:string){
 if(isDesktop())return saveLocalFile(new Uint8Array(await content.arrayBuffer()),filename);
 const url=URL.createObjectURL(content),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}
