'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
(async () => {
 const client=new Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try {
  await client.query("SELECT pg_advisory_lock(hashtext('surveystudio-migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY, sha256 char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir=path.join(__dirname,'migrations');
  for (const name of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) {
   const source=fs.readFileSync(path.join(dir,name),'utf8'), sha=crypto.createHash('sha256').update(source).digest('hex');
   const already=await client.query('SELECT sha256 FROM schema_migrations WHERE filename=$1',[name]);
   if(already.rowCount) {
     if(already.rows[0].sha256!==sha) throw Error(`Migration verändert: ${name}. Änderungen müssen in einer neuen Migration stehen.`);
     console.log('Bereits installiert:',name);continue;
   }
   await client.query('BEGIN');
   try {await client.query(source);await client.query('INSERT INTO schema_migrations(filename,sha256) VALUES($1,$2)',[name,sha]);await client.query('COMMIT');console.log('Migration OK:',name);}
   catch(e) {await client.query('ROLLBACK');throw e;}
  }
 } finally { await client.end(); }
})().catch(e=>{console.error('Migration fehlgeschlagen:',e.message);process.exitCode=1;});
