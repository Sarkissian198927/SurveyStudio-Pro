import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],optimizeDeps:{force:true,include:['@surveystudio/shared','@surveystudio/ui','@surveystudio/renderer','@surveystudio/desktop-store']},build:{commonjsOptions:{include:[/node_modules/,/packages\//]}},server:{port:5173,strictPort:true,proxy:{'/api':{target:process.env.API_PROXY_TARGET||'http://127.0.0.1:3001',changeOrigin:true}}}});
