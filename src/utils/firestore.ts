import { Timestamp } from '@/services/firebase';

/**
 * Converts Firestore Timestamp fields to JavaScript Date objects.
 * Iterates over all properties and converts any Timestamp instances.
 */
export function convertTimestamps<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else if (value && typeof value === 'object' && 'toDate' in value) {
      result[key] = (value as Timestamp).toDate();
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
