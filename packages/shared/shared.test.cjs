const { test } = require('node:test');
const assert = require('node:assert/strict');
const {createDraft,addQuestion,duplicateQuestion,moveQuestion,removeQuestion,validateDraft,validateAnswers,calculateResults} = require('./index.cjs');
test('Neuer Fragebogen ist ein gültiger Entwurf, aber noch nicht veröffentlichbar', () => {
 const d=createDraft('Feedback'); assert.equal(validateDraft(d).ok,true); assert.equal(validateDraft(d,true).ok,false);
});
test('Fragen hinzufügen, duplizieren, verschieben und löschen', () => {
 let d=addQuestion(createDraft(),'short_text'); const first=d.questions[0].key;
 d=duplicateQuestion(d, first); assert.equal(d.questions.length,2);
 const next=d.questions[1].key; d=moveQuestion(d,next,-1); assert.equal(d.pages[0].questionKeys[0],next);
 d=removeQuestion(d,first); assert.equal(d.questions.length,1); assert.equal(validateDraft(d,true).ok,true);
});
test('Ungültige Optionen und doppelte Fragen-IDs werden abgelehnt', () => {
 const d=addQuestion(addQuestion(createDraft(),'single_choice'),'short_text');
 d.questions[1].key=d.questions[0].key; assert.equal(validateDraft(d).ok,false);
});
test('Pflichtfeld, gültige Auswahl und manipulierte Antwortwerte', () => {
 let d=addQuestion(createDraft(),'single_choice'); const q=d.questions[0]; q.required=true;
 assert.equal(validateAnswers(d,{}).ok,false);
 assert.equal(validateAnswers(d,{[q.key]:'unbekannt'}).ok,false);
 assert.equal(validateAnswers(d,{[q.key]:'option_1'}).ok,true);
 assert.equal(validateAnswers(d,{[q.key]:'option_1',secret:'x'}).ok,false);
});
test('Mehrfachauswahl und Ja/Nein false werden korrekt akzeptiert', () => {
 let d=addQuestion(addQuestion(createDraft(),'multi_choice'),'boolean');
 const [a,b]=d.questions; a.required=true;b.required=true;
 assert.equal(validateAnswers(d,{[a.key]:['option_1'],[b.key]:false}).ok,true);
 assert.equal(validateAnswers(d,{[a.key]:['option_1','option_1'],[b.key]:false}).ok,false);
});
test('Ergebnisauswertung zählt Auswahloptionen deterministisch', () => {
 let d=addQuestion(createDraft(),'single_choice'); const k=d.questions[0].key;
 const result=calculateResults(d,[{question_key:k,answer_json:'option_1'},{question_key:k,answer_json:'option_1'},{question_key:k,answer_json:'option_2'}],3);
 assert.equal(result.totalResponses,3); assert.deepEqual(result.questions[0].counts.map(x=>x.count),[2,1]);
});
test('Keine JavaScript-/SVG-Bildinhalte als Bilddaten erlaubt', () => {
 const d=createDraft(); d.theme.backgroundImage='data:image/svg+xml;base64,AAA'; assert.equal(validateDraft(d).ok,false);
});

test('Whitespace allein erfüllt ein Pflicht-Textfeld nicht',()=>{
 const d=addQuestion(createDraft(),'short_text');d.questions[0].required=true;
 assert.equal(validateAnswers(d,{[d.questions[0].key]:'   '}).ok,false);
});
test('Ungültige echte Kalenderdaten werden abgelehnt',()=>{
 const d=addQuestion(createDraft(),'date');d.questions[0].required=true;
 assert.equal(validateAnswers(d,{[d.questions[0].key]:'2026-02-30'}).ok,false);
 assert.equal(validateAnswers(d,{[d.questions[0].key]:'2026-02-28'}).ok,true);
});
test('Numerische Intervalle sind nachvollziehbar begrenzt',()=>{
 const d=addQuestion(createDraft(),'number');const q=d.questions[0];q.validation={min:0,max:10};
 assert.equal(validateAnswers(d,{[q.key]:-1}).ok,false);
 assert.equal(validateAnswers(d,{[q.key]:7}).ok,true);
 q.validation={min:10,max:0};assert.equal(validateDraft(d).ok,false);
});
