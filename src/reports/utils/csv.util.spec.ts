import { toCsv } from './csv.util';

describe('toCsv', () => {
  it('should return empty string for empty array', () => {
    expect(toCsv([])).toBe('');
  });

  it('should convert a single row to CSV', () => {
    const rows = [{ name: 'Alice', age: 30 }];
    const result = toCsv(rows);

    expect(result).toBe('name,age\nAlice,30');
  });

  it('should convert multiple rows to CSV', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = toCsv(rows);

    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('should escape values containing commas', () => {
    const rows = [{ name: 'Alice, Bob', age: 30 }];
    const result = toCsv(rows);

    expect(result).toBe('name,age\n"Alice, Bob",30');
  });

  it('should escape values containing quotes', () => {
    const rows = [{ name: 'Alice "A"', age: 30 }];
    const result = toCsv(rows);

    expect(result).toBe('name,age\n"Alice ""A""",30');
  });

  it('should escape values containing newlines', () => {
    const rows = [{ name: 'Alice\nBob', age: 30 }];
    const result = toCsv(rows);

    expect(result).toBe('name,age\n"Alice\nBob",30');
  });

  it('should handle null and undefined values', () => {
    const rows = [{ name: 'Alice', email: null, phone: undefined }];
    const result = toCsv(rows);

    expect(result).toBe('name,email,phone\nAlice,,');
  });

  it('should handle numeric values', () => {
    const rows = [{ amount: 10000, rate: 85.5 }];
    const result = toCsv(rows);

    expect(result).toBe('amount,rate\n10000,85.5');
  });

  it('should handle boolean values', () => {
    const rows = [{ active: true, removed: false }];
    const result = toCsv(rows);

    expect(result).toBe('active,removed\ntrue,false');
  });

  it('should handle Date values', () => {
    const date = new Date('2026-09-01T00:00:00.000Z');
    const rows = [{ name: 'Test', date }];
    const result = toCsv(rows);

    const lines = result.split('\n');
    expect(lines[0]).toBe('name,date');
    // Date.toString() varies by timezone, so just check year and month are present
    expect(lines[1]).toContain('2026');
    expect(lines[1]).toContain('Sep');
  });
});
