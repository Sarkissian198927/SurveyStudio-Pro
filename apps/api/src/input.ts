import { isUuid } from '@surveystudio/schema';
import { BadRequestException } from '@nestjs/common';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('JSON-Objekt erwartet.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`${label} fehlt oder ist zu lang.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  if (!isUuid(value)) throw new BadRequestException('Ungültige ID.');
  return value;
}
export function email(value: unknown): string {
  const result = text(value, 'E-Mail-Adresse', 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new BadRequestException('Ungültige E-Mail-Adresse.');
  return result;
}
export function password(value: unknown): string {
  // bcrypt uses only the first 72 UTF-8 bytes. Reject instead of silently truncating.
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) throw new BadRequestException('Passwort: mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes.');
  return value;
}
