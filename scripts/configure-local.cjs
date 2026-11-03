'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'.env');
if(fs.existsSync(target)) {
  console.log('.env existiert bereits und bleibt unverändert.');
} else {
  const source=fs.readFileSync(path.join(root,'.env.example'),'utf8').replace('replace-with-a-separate-data-encryption-key',randomBytes(48).toString('hex'));
  fs.writeFileSync(target,source.replace('replace-with-a-random-secret-at-least-32-characters-long',randomBytes(48).toString('hex')),{mode:0o600,flag:'wx'});
  console.log('Lokale .env mit zufälligem Sitzungsschlüssel angelegt. Keine Produktivkonfiguration.');
}
