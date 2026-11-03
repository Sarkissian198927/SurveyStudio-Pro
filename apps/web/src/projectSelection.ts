export function selectedProject(userId:string){try{return localStorage.getItem('surveystudio.project.'+userId)||'';}catch{return '';}}
export function rememberProject(userId:string,projectId:string){try{localStorage.setItem('surveystudio.project.'+userId,projectId);}catch{}}
