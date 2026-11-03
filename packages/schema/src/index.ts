/** I-01 entity identifiers and schema types; survey runtime migration follows in I-02. */
export type EntityId = string;
export function isUuid(value: unknown): value is EntityId {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export type { SurveyDraft, SurveyQuestion, QuestionType } from '@surveystudio/shared';
