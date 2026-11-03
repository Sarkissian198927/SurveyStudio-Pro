/** Compatibility boundary for the supplied aggregation core. */
import { calculateResults as legacyCalculateResults } from '@surveystudio/shared';
import type { SurveyDraft } from '@surveystudio/shared';
export function calculateResults(draft:SurveyDraft, rows:{question_key:string;answer_json:unknown}[], totalResponses:number) {
  return legacyCalculateResults(draft,rows,totalResponses);
}
