import { describe, expect, it } from 'vitest';
import { dinhDangTyLe, MAU_MUC } from './mauMuc';

describe('mauMuc', () => {
  it('dinhDangTyLe(null) = "—"', () => {
    expect(dinhDangTyLe(null)).toBe('—');
  });

  it('dinhDangTyLe(0.783) = "78,3%"', () => {
    expect(dinhDangTyLe(0.783)).toBe('78,3%');
  });

  it('biên: 0 và 1', () => {
    expect(dinhDangTyLe(0)).toBe('0,0%');
    expect(dinhDangTyLe(1)).toBe('100,0%');
  });

  it('màu M1→M4 cố định', () => {
    expect(MAU_MUC).toEqual({ M1: 'red.6', M2: 'orange.6', M3: 'blue.6', M4: 'green.7' });
  });
});
