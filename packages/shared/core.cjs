'use strict';
/** Framework-agnostic questionnaire domain and validation. Both API and UI use this. */
const QUESTION_TYPES = Object.freeze([
  { id: 'short_text', label: 'Kurztext', icon: 'type' },
  { id: 'long_text', label: 'Langer Text', icon: 'align-left' },
  { id: 'number', label: 'Zahl', icon: 'hash' },
  { id: 'email', label: 'E-Mail', icon: 'at-sign' },
  { id: 'date', label: 'Datum', icon: 'calendar' },
  { id: 'boolean', label: 'Ja / Nein', icon: 'toggle' },
  { id: 'single_choice', label: 'Einfachauswahl', icon: 'circle-dot' },
  { id: 'multi_choice', label: 'Mehrfachauswahl', icon: 'check-square' },
  { id: 'dropdown', label: 'Dropdown', icon: 'list' }
]);
const TYPES = new Set(QUESTION_TYPES.map(t => t.id));
const CHOICES = new Set(['single_choice', 'multi_choice', 'dropdown']);
const DEFAULT_FONT = 'Inter, Arial, sans-serif';
const FONTS = new Set([DEFAULT_FONT, 'Arial, sans-serif', 'Georgia, serif', 'Verdana, sans-serif', 'Tahoma, sans-serif']);
const id = () => globalThis.crypto.randomUUID();
const clone = value => JSON.parse(JSON.stringify(value));
const option = (label, value) => ({ label, value });
function newQuestion(type) {
  if (!TYPES.has(type)) throw new TypeError('Unbekannter Fragetyp');
  return {
    key: id(), type, label: 'Neue Frage', description: '', required: false,
    options: CHOICES.has(type) ? [option('Option 1', 'option_1'), option('Option 2', 'option_2')] : [],
    style: { bold: false, italic: false, color: '#172a43' },
    validation: {}
  };
}
function createDraft(title = 'Neue Umfrage') {
  return {
    schemaVersion: '1.0',
    metadata: { title, description: '', intro: 'Schön, dass Sie teilnehmen!', outro: 'Vielen Dank für Ihre Teilnahme.' },
    theme: { primaryColor: '#3569E8', backgroundColor: '#F6F8FC', textColor: '#172A43', fontFamily: DEFAULT_FONT, backgroundImage: null, logoImage: null },
    pages: [{ key: id(), title: 'Fragebogen', questionKeys: [] }],
    questions: [], settings: { showProgress: true },
    privacy: { mode: 'anonymous', privacyNotice: 'Diese Umfrage speichert keine Zuordnung Ihrer Antworten zu einer Person. Freitextantworten können dennoch persönliche Angaben enthalten.' }
  };
}
function addQuestion(draft, type) {
  const copy = clone(draft), question = newQuestion(type);
  copy.questions.push(question);
  copy.pages[0].questionKeys.push(question.key);
  return copy;
}
function duplicateQuestion(draft, key) {
  const copy = clone(draft), source = copy.questions.find(q => q.key === key);
  if (!source) return copy;
  const duplicate = { ...clone(source), key: id(), label: `${source.label} (Kopie)` };
  const index = copy.questions.findIndex(q => q.key === key);
  copy.questions.splice(index + 1, 0, duplicate);
  const keys = copy.pages[0].questionKeys;
  keys.splice(keys.indexOf(key) + 1, 0, duplicate.key);
  return copy;
}
function removeQuestion(draft, key) {
  const copy = clone(draft);
  copy.questions = copy.questions.filter(q => q.key !== key);
  for (const page of copy.pages) page.questionKeys = page.questionKeys.filter(k => k !== key);
  return copy;
}
function moveQuestion(draft, key, offset) {
  const copy = clone(draft), keys = copy.pages[0].questionKeys;
  const from = keys.indexOf(key), to = from + offset;
  if (from < 0 || to < 0 || to >= keys.length) return copy;
  keys.splice(to, 0, keys.splice(from, 1)[0]);
  copy.questions = keys.map(k => copy.questions.find(q => q.key === k));
  return copy;
}
const isObject = v => v != null && typeof v === 'object' && !Array.isArray(v);
const hex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const saneString = (v, limit) => typeof v === 'string' && v.length <= limit;
const imageSafe = v => v === null || (typeof v === 'string' && v.length <= 2200000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v));
function validateDraft(draft, forPublish = false) {
  const errors = [];
  if (!isObject(draft)) return { ok: false, errors: ['Fragebogendaten fehlen.'] };
  if (draft.schemaVersion !== '1.0') errors.push('Unbekannte Schemaversion.');
  if (!isObject(draft.metadata) || !saneString(draft.metadata.title, 160) || !draft.metadata.title.trim()) errors.push('Bitte einen gültigen Umfragetitel angeben (maximal 160 Zeichen).');
  if (!isObject(draft.metadata) || !['description', 'intro', 'outro'].every(f => saneString(draft.metadata[f], 4000))) errors.push('Beschreibung oder Begrüßungs-/Abschlusstext ist zu lang.');
  if (!isObject(draft.theme) || !['primaryColor', 'backgroundColor', 'textColor'].every(k => hex(draft.theme[k]))) errors.push('Ungültige Farbangabe.');
  if (!isObject(draft.theme) || !FONTS.has(draft.theme.fontFamily)) errors.push('Nicht erlaubte Schriftart.');
  if (!isObject(draft.theme) || !imageSafe(draft.theme.backgroundImage) || !imageSafe(draft.theme.logoImage)) errors.push('Hintergrund oder Logo hat ein ungültiges Bildformat.');
  if (!Array.isArray(draft.pages) || draft.pages.length !== 1 || !Array.isArray(draft.pages[0]?.questionKeys)) errors.push('Die aktuelle Version unterstützt genau eine Fragebogenseite.');
  if (!Array.isArray(draft.questions) || draft.questions.length > 200) errors.push('Ungültige Anzahl an Fragen (maximal 200).');
  if (!isObject(draft.privacy) || draft.privacy.mode !== 'anonymous' || !saneString(draft.privacy.privacyNotice, 4000)) errors.push('Datenschutzeinstellungen ungültig.');
  if (!isObject(draft.settings) || typeof draft.settings.showProgress !== 'boolean') errors.push('Fragebogeneinstellungen ungültig.');
  if (errors.length || !Array.isArray(draft.questions)) return { ok: false, errors };
  const keys = new Set();
  for (const [i,q] of draft.questions.entries()) {
    if (!isObject(q) || !saneString(q.key, 100) || !q.key || keys.has(q.key)) { errors.push(`Frage ${i + 1}: Ungültige oder doppelte ID.`); continue; }
    keys.add(q.key);
    if (!TYPES.has(q.type)) errors.push(`Frage ${i + 1}: Unbekannter Typ.`);
    if (!saneString(q.label, 600) || !q.label.trim()) errors.push(`Frage ${i + 1}: Fragetext fehlt oder ist zu lang.`);
    if (!saneString(q.description, 2000) || typeof q.required !== 'boolean') errors.push(`Frage ${i + 1}: Ungültige Eigenschaften.`);
    if (!Array.isArray(q.options)) errors.push(`Frage ${i + 1}: Ungültige Antworten.`);
    else if (CHOICES.has(q.type)) {
      if (q.options.length < 2 || q.options.length > 40) errors.push(`Frage ${i + 1}: 2 bis 40 Auswahlmöglichkeiten erforderlich.`);
      const values = new Set();
      for (const o of q.options) {
        if (!isObject(o) || !saneString(o.label, 200) || !o.label.trim() || !saneString(o.value, 100) || !o.value || values.has(o.value)) errors.push(`Frage ${i + 1}: Ungültige oder doppelte Auswahloption.`);
        else values.add(o.value);
      }
    } else if (q.options.length) errors.push(`Frage ${i + 1}: Dieser Fragetyp hat keine Auswahloptionen.`);
    if (q.style && (!isObject(q.style) || (q.style.color !== undefined && !hex(q.style.color)))) errors.push(`Frage ${i + 1}: Ungültige Textfarbe.`);
    if (q.validation && !isObject(q.validation)) errors.push(`Frage ${i + 1}: Ungültige Validierung.`);
    if (isObject(q.validation)) {
      for (const field of ['min','max','minLength','maxLength']) if(q.validation[field] !== undefined && (typeof q.validation[field] !== 'number' || !Number.isFinite(q.validation[field]))) errors.push(`Frage ${i + 1}: Ungültiger Validierungswert.`);
      if (q.validation.min !== undefined && q.validation.max !== undefined && q.validation.min > q.validation.max) errors.push(`Frage ${i + 1}: Minimalwert über Maximalwert.`);
      if (q.validation.minLength !== undefined && (q.validation.minLength < 0 || !Number.isInteger(q.validation.minLength))) errors.push(`Frage ${i + 1}: Ungültige Mindestlänge.`);
      if (q.validation.maxLength !== undefined && (q.validation.maxLength < 0 || !Number.isInteger(q.validation.maxLength))) errors.push(`Frage ${i + 1}: Ungültige Maximallänge.`);
      if (q.validation.minLength !== undefined && q.validation.maxLength !== undefined && q.validation.minLength > q.validation.maxLength) errors.push(`Frage ${i + 1}: Mindestlänge über Maximallänge.`);
    }
  }
  if (Array.isArray(draft.pages) && Array.isArray(draft.pages[0]?.questionKeys)) {
    const list = draft.pages[0].questionKeys;
    if (list.length !== draft.questions.length || new Set(list).size !== list.length || list.some(k => !keys.has(k))) errors.push('Die Reihenfolge der Fragen ist ungültig.');
  }
  if (forPublish && draft.questions.length === 0) errors.push('Zum Veröffentlichen muss mindestens eine Frage vorhanden sein.');
  return { ok: errors.length === 0, errors };
}
function validateAnswers(draft, answers) {
  const errors = [];
  if (!isObject(answers)) return { ok: false, errors: ['Antworten müssen ein Objekt sein.'] };
  const allowed = new Set(draft.questions.map(q => q.key));
  for (const key of Object.keys(answers)) if (!allowed.has(key)) errors.push('Unbekannte Frage in der Antwort.');
  for (const q of draft.questions) {
    const v = answers[q.key];
    const empty = v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    if (empty) { if (q.required) errors.push(`Bitte beantworten: ${q.label}`); continue; }
    if (q.type === 'short_text' || q.type === 'long_text' || q.type === 'email') {
      if (typeof v !== 'string' || v.trim().length > (q.type === 'long_text' ? 5000 : 500) || (typeof q.validation?.minLength === 'number' && v.length < q.validation.minLength) || (typeof q.validation?.maxLength === 'number' && v.length > q.validation.maxLength)) errors.push(`Ungültiger Text: ${q.label}`);
      if (q.type === 'email' && (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) errors.push(`Ungültige E-Mail-Adresse: ${q.label}`);
    } else if (q.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || (typeof q.validation?.min === 'number' && v < q.validation.min) || (typeof q.validation?.max === 'number' && v > q.validation.max)) errors.push(`Ungültige Zahl: ${q.label}`);
    } else if (q.type === 'date') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) errors.push(`Ungültiges Datum: ${q.label}`);
    } else if (q.type === 'boolean') {
      if (typeof v !== 'boolean') errors.push(`Ungültige Ja/Nein-Antwort: ${q.label}`);
    } else if (CHOICES.has(q.type)) {
      const values = new Set(q.options.map(o => o.value));
      if (q.type === 'multi_choice') {
        if (!Array.isArray(v) || !v.length || new Set(v).size !== v.length || v.some(e => typeof e !== 'string' || !values.has(e))) errors.push(`Ungültige Mehrfachauswahl: ${q.label}`);
      } else if (typeof v !== 'string' || !values.has(v)) errors.push(`Ungültige Auswahl: ${q.label}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
function calculateResults(draft, rows, totalResponses) {
  return {
    totalResponses,
    questions: draft.questions.map(q => {
      const values = rows.filter(row => row.question_key === q.key).map(row => row.answer_json);
      const result = { key: q.key, type: q.type, label: q.label, answered: values.length };
      if (CHOICES.has(q.type) || q.type === 'boolean') {
        const choices = q.type === 'boolean' ? [option('Ja','true'), option('Nein','false')] : q.options;
        result.counts = choices.map(o => {
          const count = values.filter(v => (Array.isArray(v) ? v.includes(o.value) : String(v) === o.value)).length;
          return { label: o.label, count, percentage: values.length ? Math.round(count / values.length * 1000) / 10 : 0 };
        });
      }
      if (q.type === 'number') result.mean = values.length ? Math.round(values.reduce((sum,v) => sum + Number(v), 0) / values.length * 100) / 100 : null;
      return result;
    })
  };
}
module.exports = { QUESTION_TYPES, newQuestion, createDraft, addQuestion, duplicateQuestion, removeQuestion, moveQuestion, validateDraft, validateAnswers, calculateResults };
