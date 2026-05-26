import { isProductionRuntime } from "../lib/runtimeMode";

const demoPatterns = [
  /smoke/i,
  /demo-/i,
  /test-/i,
  /web-demo-token/i,
  /production smoke/i
];

export const isDemoLikeRecord = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return demoPatterns.some((pattern) => pattern.test(value));
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(isDemoLikeRecord);
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, entry]) => isDemoLikeRecord(key) || isDemoLikeRecord(entry)
    );
  }

  return false;
};

export const hideDemoRecordInProduction = <T>(record: T): boolean =>
  isProductionRuntime() && isDemoLikeRecord(record);

export const filterProductionRecords = <T>(records: T[]): T[] =>
  records.filter((record) => !hideDemoRecordInProduction(record));

