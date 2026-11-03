'use strict';
const https=require('node:https'),fs=require('node:fs');
const server=https.createServer({pfx:fs.readFileSync(process.env.ONLINE_TEST_PFX),passphrase:process.env.ONLINE_TEST_PASSWORD},(request,response)=>{
 response.setHeader('Cache-Control','no-store');
 if(request.url==='/api/v1/health'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({status:'ok',service:'surveystudio-pro',version:'0.5.0'}));}
 else if(request.url==='/login'){fs.writeFileSync(process.env.ONLINE_PORTAL_MARKER,'opened');response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>SurveyStudio TLS Test</title><h1>Online portal test</h1>');}
 else {response.writeHead(404);response.end();}
});server.listen(7443,'127.0.0.1',()=>console.log('Local HTTPS protocol fixture ready.'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
