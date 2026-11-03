export type QuestionType = 'short_text' | 'long_text' | 'number' | 'date' | 'email' | 'boolean' | 'single_choice' | 'multi_choice' | 'dropdown' | 'rating' | 'slider' | 'nps' | 'likert' | 'matrix_single' | 'matrix_multi' | 'ranking' | 'image_choice' | 'file_upload' | 'time_slot';
export type QuestionOption = { value: string; label: string; image?: string };
export type Rule = {mode:'all'|'any';conditions:{questionKey:string;operator:'eq'|'neq'|'contains'|'gt'|'lt'|'answered';value?:string|number|boolean}[]};
export type SurveyQuestion = {
  rows?: QuestionOption[]; visibility?: Rule; requiredWhen?: Rule;
  key: string;
  type: QuestionType;
  label: string;
  description: string;
  required: boolean;
  options: QuestionOption[];
  style?: { bold?: boolean; italic?: boolean; color?: string };
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number; step?: number };
};
export type SurveyDraft = {
  schemaVersion: '1.0';
  metadata: { title: string; description: string; intro: string; outro: string; header?:string; footer?:string };
  theme: { primaryColor: string; backgroundColor: string; textColor: string; fontFamily: string; backgroundImage: string | null; logoImage: string | null; backgroundMode?:'solid'|'gradient'|'pattern'|'image'; secondaryColor?:string; gradientAngle?:number; pattern?:'dots'|'grid'|'diagonal'; backgroundSize?:'cover'|'contain'|'repeat'; backgroundPosition?:'center'|'top'|'bottom'|'left'|'right'; overlayOpacity?:number; paperOpacity?:number };
  pages: { key: string; title: string; questionKeys: string[]; nextRules?:{when:Rule;target:string}[] }[];
  questions: SurveyQuestion[];
  logic?: unknown[];
  settings: { showProgress: boolean };
  privacy: { mode: 'anonymous'|'pseudonymous'|'identifiable'; privacyNotice: string; retentionDays?:number; minGroupSize?:number;controller?:string;contact?:string;purpose?:string;legalBasis?:string;noticeRevision?:string;requireConsent?:boolean;consentText?:string };
};
export type ValidationResult = { ok: boolean; errors: string[] };
export const QUESTION_TYPES: { id: QuestionType; label: string; icon: string }[];
export function newQuestion(type: QuestionType): SurveyQuestion;
export function createDraft(title?: string): SurveyDraft;
export function addQuestion(draft: SurveyDraft, type: QuestionType, pageKey?:string): SurveyDraft;
export function duplicateQuestion(draft: SurveyDraft, key: string): SurveyDraft;
export function removeQuestion(draft: SurveyDraft, key: string): SurveyDraft;
export function moveQuestion(draft: SurveyDraft, key: string, offset: number): SurveyDraft;
export function validateDraft(draft: unknown, forPublish?: boolean, requirePrivacy?:boolean): ValidationResult;
export function validateAnswers(draft: SurveyDraft, answers: Record<string, unknown>, questionKeys?:string[]): ValidationResult;
export function calculateResults(draft: SurveyDraft, rows: { question_key: string; answer_json: unknown }[], totalResponses: number): {
  totalResponses: number;
  questions: { key: string; type: QuestionType; label: string; counts?: { label: string; count: number; percentage: number }[]; answered: number; mean?: number | null; median?:number; stddev?:number; min?:number; max?:number; nps?:number; matrix?:{label:string;counts:{label:string;count:number}[]}[]; ranking?:{label:string;meanRank:number}[] }[];
};

export function backgroundStyle(theme:SurveyDraft['theme']):Record<string,string|number>;
export function evaluateRule(rule:Rule|undefined,answers:Record<string,unknown>,visible?:(key:string)=>boolean):boolean;
export function visibleQuestions(draft:SurveyDraft,answers:Record<string,unknown>):SurveyQuestion[];
export function cleanAnswers(draft:SurveyDraft,answers:Record<string,unknown>):Record<string,unknown>;
export function canonicalJson(value:unknown):string;

export function flowPages(draft:SurveyDraft,answers:Record<string,unknown>):SurveyDraft['pages'];

export function validateConsent(draft:SurveyDraft,consent:unknown):boolean;
