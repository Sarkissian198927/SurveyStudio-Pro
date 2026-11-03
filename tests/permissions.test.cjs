const {test}=require('node:test');
const assert=require('node:assert/strict');
const {permits,isProjectRole}=require('../apps/api/dist/permissions');
const input=require('../apps/api/dist/input');
for(const role of ['owner','editor','viewer','analyst','guest','admin',null,'']) {
  test(`Projektrolle ${role}: vollständige Rechtematrix`,()=>{
    assert.equal(permits(role,'read'),['owner','editor','viewer','analyst','guest'].includes(role));
    assert.equal(permits(role,'write'),['owner','editor'].includes(role));
    assert.equal(permits(role,'manage'),role==='owner');
    assert.equal(isProjectRole(role),['owner','editor','viewer','analyst','guest'].includes(role));
  });
}
test('Ungültige Eingaben werden abgelehnt, Unicode wird erhalten',()=>{
  for(const value of [null,[],1,'title'])assert.throws(()=>input.object(value));
  for(const value of [undefined,{},[],9,' ','x'.repeat(161)])assert.throws(()=>input.text(value,'Titel'));
  assert.equal(input.text('  Grüße 東京  ','Titel'),'Grüße 東京');
  assert.equal(input.email(' NAME@EXAMPLE.ORG '),'name@example.org');
  for(const value of ['abc',{},null])assert.throws(()=>input.uuid(value));
  assert.throws(()=>input.password('a'.repeat(73)));
  assert.throws(()=>input.password('ü'.repeat(37)));
  assert.throws(()=>input.password('kurz'));
  assert.equal(input.password('ü'.repeat(36)),'ü'.repeat(36));
});
