/**
 * Convert an array of objects to a CSV string.
 * Uses the keys of the first object as headers.
 * Escapes values that contain commas, quotes, or newlines.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escapedHeaders = headers.map(escapeCsvValue);
  const lines = [escapedHeaders.join(',')];

  for (const row of rows) {
    const values = headers.map((h) => escapeCsvValue(row[h]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function escapeCsvValue(value: unknown): string {
  if (value == null) return '';

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
