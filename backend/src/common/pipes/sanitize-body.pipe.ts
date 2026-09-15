import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/** Only user-supplied JSON-ish inputs are sanitised; files and custom params pass through untouched. */
const SANITIZED_TYPES = new Set<ArgumentMetadata['type']>(['body', 'query', 'param']);

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    // Binary / typed / temporal objects must survive as-is: rebuilding them via
    // Object.entries turns a Buffer into `{0: 255, 1: 216, …}` and drops `.length`.
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Date) {
      return value;
    }
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

@Injectable()
export class SanitizeBodyPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    // `custom` covers @UploadedFile()/@UploadedFiles()/@CurrentUser() etc.
    if (!SANITIZED_TYPES.has(metadata?.type)) return value;
    return sanitizeValue(value);
  }
}
