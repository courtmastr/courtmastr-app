export type JsonPrimitive = string | number | boolean | null | undefined;
export type JsonLike = JsonPrimitive | Date | JsonLike[] | { [key: string]: JsonLike };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasIdProperty = (value: unknown): value is { id: unknown } =>
  isRecord(value) && 'id' in value;

export const removeUndefinedDeep = <T>(value: T): T => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const cleanedArray = value.map((item) => removeUndefinedDeep(item));
    return cleanedArray as T;
  }

  if (!isRecord(value)) return value;

  const cleaned: Record<string, unknown> = {};
  for (const [key, currentValue] of Object.entries(value)) {
    if (currentValue !== undefined) {
      cleaned[key] = removeUndefinedDeep(currentValue);
    }
  }

  return cleaned as T;
};

export const normalizeReferences = <T>(value: T): T => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const normalizedArray = value.map((item) => normalizeReferences(item));
    return normalizedArray as T;
  }

  if (!isRecord(value)) return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, currentValue] of Object.entries(value)) {
    if (key === 'id') {
      normalized[key] = currentValue;
      continue;
    }

    if (key.endsWith('_id') && hasIdProperty(currentValue)) {
      normalized[key] = String(currentValue.id);
      continue;
    }

    normalized[key] = normalizeReferences(currentValue);
  }

  return normalized as T;
};
